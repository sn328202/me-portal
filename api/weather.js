import { createClient } from '@supabase/supabase-js';
import { geocodeArea } from './_place.js';

/**
 * POST /api/weather   { tripId }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Fills in the weather for every day of a trip.
 *
 * Two different questions, depending on how far off the day is:
 *
 *   within ~16 days  a real forecast
 *   beyond that      what the last ten years actually did on those dates at
 *                    that spot, averaged
 *
 * The second is the useful one, because that is when trips get planned. It is
 * deliberately *not* presented as a forecast — the row records which kind of
 * answer it is so the UI can caption it honestly. A "72°" that is really
 * "72° on average" is worse than no number at all, because it gets packed for.
 *
 * Open-Meteo needs no API key and no account, which is why it is here rather
 * than one of the paid services.
 */

export const config = { maxDuration: 60 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';

/** How many past years to average when a date is beyond the forecast horizon. */
const YEARS = 10;
const DAILY = 'temperature_2m_max,temperature_2m_min,weather_code';

const get = async (url, timeout = 12000) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error(`weather service returned ${res.status}`);
    return res.json();
};

const mean = (values) => {
    const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (!nums.length) return null;
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
};

/** The code that turned up most often across the sampled years. */
const commonest = (codes) => {
    const counts = new Map();
    for (const c of codes) {
        if (c === null || c === undefined) continue;
        counts.set(c, (counts.get(c) || 0) + 1);
    }
    let best = null;
    let seen = 0;
    for (const [code, n] of counts) {
        if (n > seen) { best = code; seen = n; }
    }
    return best;
};

const iso = (d) => d.toISOString().slice(0, 10);

/** Real forecast, keyed by date. Open-Meteo gives 16 days. */
async function forecastFor({ lat, lng }) {
    const url = `${FORECAST}?latitude=${lat}&longitude=${lng}&daily=${DAILY}`
        + '&temperature_unit=fahrenheit&timezone=auto&forecast_days=16';
    const data = await get(url);
    const out = {};
    (data?.daily?.time || []).forEach((date, i) => {
        out[date] = {
            high: data.daily.temperature_2m_max?.[i] ?? null,
            low: data.daily.temperature_2m_min?.[i] ?? null,
            code: data.daily.weather_code?.[i] ?? null,
            source: 'forecast',
        };
    });
    return out;
}

/**
 * What these dates have historically been like.
 *
 * One archive request per past year rather than one enormous range: the
 * archive is happier with short windows, and a year that fails just drops out
 * of the average instead of taking the whole answer with it.
 */
async function normalsFor({ lat, lng }, dates) {
    if (!dates.length) return {};

    const sorted = [...dates].sort();
    const first = new Date(`${sorted[0]}T12:00:00Z`);
    const last = new Date(`${sorted[sorted.length - 1]}T12:00:00Z`);
    const thisYear = new Date().getUTCFullYear();

    // Keyed by MM-DD so a trip crossing New Year still lines up.
    const samples = {};
    for (const date of sorted) samples[date] = { highs: [], lows: [], codes: [] };

    const years = [];
    for (let i = 1; i <= YEARS; i += 1) years.push(thisYear - i);

    const results = await Promise.allSettled(years.map((year) => {
        const shift = (d) => {
            const c = new Date(d);
            c.setUTCFullYear(c.getUTCFullYear() - (thisYear - year));
            return iso(c);
        };
        const url = `${ARCHIVE}?latitude=${lat}&longitude=${lng}`
            + `&start_date=${shift(first)}&end_date=${shift(last)}`
            + `&daily=${DAILY}&temperature_unit=fahrenheit&timezone=auto`;
        return get(url, 15000).then((data) => ({ year, data }));
    }));

    let used = 0;
    for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const { year, data } = result.value;
        const times = data?.daily?.time || [];
        if (!times.length) continue;
        used += 1;

        times.forEach((histDate, i) => {
            // Map the historical date back onto the trip's date by offset.
            const back = new Date(`${histDate}T12:00:00Z`);
            back.setUTCFullYear(back.getUTCFullYear() + (thisYear - year));
            const key = iso(back);
            if (!samples[key]) return;
            samples[key].highs.push(data.daily.temperature_2m_max?.[i]);
            samples[key].lows.push(data.daily.temperature_2m_min?.[i]);
            samples[key].codes.push(data.daily.weather_code?.[i]);
        });
    }

    const out = {};
    for (const [date, s] of Object.entries(samples)) {
        const high = mean(s.highs);
        if (high === null) continue;
        out[date] = {
            high,
            low: mean(s.lows),
            code: commonest(s.codes),
            source: 'normal',
            years: used,
        };
    }
    return out;
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST with a session.' });
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Not configured.' });
    }

    const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return res.status(401).json({ error: 'Sign in first.' });
    const { data: auth, error: authError } = await sb.auth.getUser(bearer);
    if (authError || !auth?.user) return res.status(401).json({ error: 'That session has expired.' });
    const userId = auth.user.id;

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const tripId = body.tripId;
    if (!tripId) return res.status(400).json({ error: 'Which trip?' });

    const { data: trip } = await sb
        .from('atlas_trips').select('id, destination, coordinates')
        .eq('id', tripId).eq('user_id', userId).maybeSingle();
    if (!trip) return res.status(404).json({ error: 'No such trip.' });

    const { data: days } = await sb
        .from('atlas_days').select('id, date, city')
        .eq('trip_id', tripId).eq('user_id', userId).order('date');

    if (!days?.length) return res.status(200).json({ filled: 0, reason: 'no days yet' });

    /* ---------- where to look ------------------------------------------
       A day can name its own city, and on a trip that moves it usually does -
       the sheet had a "Primary City" row for exactly this reason, and Goa in
       December is not Kerala in December. So each distinct city is located
       once and its own weather fetched.

       The trip's own coordinates are the fallback. If it has none - which was
       true of every trip here - the destination is geocoded and written back,
       so this only ever happens once. Returning "no coordinates" and stopping
       would have been correct and useless.                                  */

    const cities = [...new Set(days.map((d) => (d.city || '').trim()).filter(Boolean))];
    const located = {};

    for (const city of cities) {
        const area = await geocodeArea(city).catch(() => null);
        if (area) located[city] = { lat: area.lat, lng: area.lng };
    }

    let home = trip.coordinates && Number.isFinite(Number(trip.coordinates.lat))
        ? { lat: Number(trip.coordinates.lat), lng: Number(trip.coordinates.lng) }
        : null;

    if (!home && trip.destination) {
        const area = await geocodeArea(trip.destination).catch(() => null);
        if (area) {
            home = { lat: area.lat, lng: area.lng };
            // Remembered, so the next run does not pay for this again.
            await sb.from('atlas_trips')
                .update({ coordinates: home }).eq('id', tripId).eq('user_id', userId);
        }
    }

    if (!home && !Object.keys(located).length) {
        return res.status(200).json({
            filled: 0,
            reason: `could not find "${trip.destination || 'this trip'}" on a map - `
                + 'name a city on a day, or check the destination spelling',
        });
    }

    /** Where a given day is, as precisely as we know. */
    const placeOf = (day) => located[(day.city || '').trim()] || home;

    const today = iso(new Date());
    const near = days.filter((d) => d.date >= today
        && (new Date(`${d.date}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86400000 <= 15);
    const far = days.filter((d) => !near.includes(d));

    const problems = [];
    // Keyed by "lat,lng" so two days in the same city cost one request.
    const byPlace = new Map();

    const key = (p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;

    for (const group of [near, far]) {
        for (const day of group) {
            const place = placeOf(day);
            if (!place) continue;
            const k = key(place);
            if (!byPlace.has(k)) byPlace.set(k, { place, near: [], far: [] });
            byPlace.get(k)[group === near ? 'near' : 'far'].push(day.date);
        }
    }

    const weatherFor = {};
    for (const { place, near: nearDates, far: farDates } of byPlace.values()) {
        if (nearDates.length) {
            try {
                Object.assign(weatherFor, await forecastFor(place));
            } catch (err) {
                problems.push(`forecast: ${err.message}`);
            }
        }
        if (farDates.length) {
            try {
                Object.assign(weatherFor, await normalsFor(place, farDates));
            } catch (err) {
                problems.push(`averages: ${err.message}`);
            }
        }
    }

    let filled = 0;
    for (const day of days) {
        const weather = weatherFor[day.date];
        if (!weather) continue;
        const { error } = await sb.from('atlas_days')
            .update({ weather, weather_at: new Date().toISOString() })
            .eq('id', day.id).eq('user_id', userId);
        if (!error) filled += 1;
    }

    return res.status(200).json({
        filled,
        of: days.length,
        // Said plainly rather than failing silently: a trip two years out has
        // no forecast and only patchy archive data, and the UI should be able
        // to explain the blanks.
        problems: problems.length ? problems : undefined,
    });
}
