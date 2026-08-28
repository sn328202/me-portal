import { createClient } from '@supabase/supabase-js';
import { geocodeArea } from './_place.js';

/**
 * Put the trip on the map.
 *
 * The Atlas had coordinates only where she had clicked a waypoint onto the map
 * by hand, so the map showed a handful of pins and none of the cities she had
 * actually planned. The legs know the cities; they just did not know where
 * those cities are.
 *
 * Geocoding also gets the country, which is what the flags on the trip cards
 * are made of. That is the same request either way, so it happens here rather
 * than as a second pass over the same names.
 *
 * Runs server-side because the Places key lives there, because the same city
 * appearing on three trips should be looked up once, and because the answer
 * wants storing rather than re-fetching on every render.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

/* A leg named after a mode of transport is not somewhere to look up. Kept in
   step with isTravelLeg in src/utils/tripLegs.js. */
const TRAVEL = /^(air ?travel|travel|travel ?day|flight|flying|airplane|plane|in ?transit|transit|driving|road ?trip|train)$/i;

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

    const { data: legs } = await sb
        .from('atlas_legs').select('id, city, lat, lng, country, country_code')
        .eq('trip_id', tripId).eq('user_id', userId);

    /* Only what is actually missing, and only once per distinct city: a trip
       that returns to Mumbai should not pay for Mumbai twice. */
    const wanted = (legs || []).filter((leg) => (
        leg.city && !TRAVEL.test(leg.city.trim())
        && (leg.lat == null || leg.lng == null || !leg.country_code)
    ));

    const found = {};
    for (const city of [...new Set(wanted.map((l) => l.city.trim()))]) {
        const area = await geocodeArea(city).catch(() => null);
        if (area?.lat != null) found[city] = area;
    }

    let located = 0;
    for (const leg of wanted) {
        const area = found[leg.city.trim()];
        if (!area) continue;
        const { error } = await sb.from('atlas_legs').update({
            lat: area.lat,
            lng: area.lng,
            country: area.country || leg.country || null,
            country_code: area.countryCode || leg.country_code || null,
        }).eq('id', leg.id).eq('user_id', userId);
        if (!error) located += 1;
    }

    /* The trip's own pin, for the index map. Falls back to its destination
       when it has no legs yet, so a trip that is still just a name still
       appears somewhere. */
    let centre = trip.coordinates;
    if (!centre?.lat) {
        const anchor = Object.values(found)[0]
            || (trip.destination ? await geocodeArea(trip.destination).catch(() => null) : null);
        if (anchor?.lat != null) {
            centre = { lat: anchor.lat, lng: anchor.lng };
            await sb.from('atlas_trips').update({ coordinates: centre })
                .eq('id', tripId).eq('user_id', userId);
        }
    }

    const missing = wanted.filter((l) => !found[l.city.trim()]).map((l) => l.city);

    return res.status(200).json({
        located,
        of: wanted.length,
        centre: centre || null,
        // Named rather than counted: "could not find Lauterbrunnen" is
        // actionable, "3 of 5" is not.
        missing,
    });
}
