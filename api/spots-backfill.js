import { createClient } from '@supabase/supabase-js';
import { placeDetails, geocodeAddress, toCategory, mapsSearchUrl } from './_place.js';

/**
 * POST /api/spots-backfill
 * Header: Authorization: Bearer <supabase access token>
 *
 * Twenty-eight places were saved through the old day planner before Spots
 * existed. They carry Google place ids, addresses and ratings, but live only
 * as rows inside particular itineraries — so they cannot appear on a map, and
 * "what have I saved near Napa" cannot see them at all.
 *
 * This lifts each one into a spot and points `plan_items.spot_id` back at it,
 * so the itinerary and the library are the same place rather than two copies
 * that drift.
 *
 * Idempotent: an item that already has a spot_id is skipped, and a place
 * already in Spots is linked rather than duplicated.
 */

export const config = { maxDuration: 60 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

// Nominatim's usage policy is one request a second. With a Places key there is
// no such limit, which is most of why the key is worth having.
const FREE_GAP_MS = 1100;
const KEYED_GAP_MS = 60;
const BATCH = 25;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A plan item's activity is often "Onsen Dinner" when the place is "Onsen". */
const cleanName = (activity, location) => {
    const fromAddress = (location || '').split(',')[0]?.trim();
    const name = (activity || '').trim();
    if (!name) return fromAddress || 'Saved place';
    // Prefer the address's own first line when the activity just decorates it.
    if (fromAddress && name.toLowerCase().startsWith(fromAddress.toLowerCase())) return fromAddress;
    return name;
};

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST with a session.' });
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Not configured.' });
    }

    const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    // Either the signed-in session, or the capture token for running this from
    // a terminal — it is a one-off migration as much as a feature, and being
    // able to re-run it without a browser is worth the few lines.
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const token = (req.headers['x-capture-token'] || '').toString().trim();

    let userId = null;
    if (bearer) {
        const { data: auth, error: authError } = await sb.auth.getUser(bearer);
        if (authError || !auth?.user) return res.status(401).json({ error: 'That session has expired.' });
        userId = auth.user.id;
    } else if (token && process.env.CAPTURE_TOKEN && token === process.env.CAPTURE_TOKEN.trim()) {
        userId = process.env.PORTAL_USER_ID;
    }

    if (!userId) return res.status(401).json({ error: 'Sign in first.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    /* ---------- repair ------------------------------------------------
       The first version of this read city and neighbourhood by splitting
       formattedAddress on commas, which put "CA 94110" in the city field for
       every row. Google's typed addressComponents fixes it, but the rows are
       already written — so re-read the places we have ids for and correct
       them in place. Idempotent; safe to run whenever.                    */
    if (body.repair) {
        const { data: broken, error: brokenError } = await sb
            .from('spots').select('id, place_id, city, neighborhood')
            .eq('user_id', userId).not('place_id', 'is', null).limit(60);
        if (brokenError) return res.status(500).json({ error: brokenError.message });

        let fixed = 0;
        for (const spot of broken || []) {
            const detail = await placeDetails(spot.place_id);
            if (!detail) continue;
            if (detail.city === spot.city && detail.neighborhood === spot.neighborhood) continue;
            const { error } = await sb.from('spots')
                .update({ city: detail.city, neighborhood: detail.neighborhood })
                .eq('id', spot.id);
            if (!error) fixed += 1;
        }
        return res.status(200).json({ repaired: fixed, checked: (broken || []).length });
    }
    const hasKey = Boolean(process.env.GOOGLE_PLACES_API_KEY);
    const gap = hasKey ? KEYED_GAP_MS : FREE_GAP_MS;

    const { data: items, error: itemsError } = await sb
        .from('plan_items')
        .select('id, activity, location, place_id, place_data, notes')
        .eq('user_id', userId)
        .is('spot_id', null)
        .not('location', 'is', null)
        .limit(BATCH);

    if (itemsError) return res.status(500).json({ error: itemsError.message });
    if (!items?.length) {
        return res.status(200).json({ created: 0, linked: 0, skipped: 0, remaining: 0, done: true });
    }

    // Everything already in Spots, so a place saved twice links rather than
    // duplicating. Matched on Google's id first, then on name.
    const { data: existing } = await sb
        .from('spots').select('id, name, place_id').eq('user_id', userId);

    const byPlaceId = new Map((existing || []).filter((s) => s.place_id).map((s) => [s.place_id, s.id]));
    const byName = new Map((existing || []).map((s) => [s.name.trim().toLowerCase(), s.id]));

    let created = 0;
    let linked = 0;
    const failures = [];

    for (const item of items) {
        try {
            const name = cleanName(item.activity, item.location);
            let spotId = (item.place_id && byPlaceId.get(item.place_id))
                || byName.get(name.trim().toLowerCase())
                || null;

            if (!spotId) {
                // Google's id gives the full record; without a key, geocoding
                // the stored address at least puts it on the map.
                const detail = item.place_id ? await placeDetails(item.place_id) : null;
                const point = detail || await geocodeAddress(item.location);

                const row = {
                    user_id: userId,
                    name: detail?.name || name,
                    category: detail?.category || toCategory(item.activity) || null,
                    why: item.notes || null,
                    address: detail?.address || point?.address || item.location,
                    neighborhood: detail?.neighborhood || null,
                    city: detail?.city || null,
                    lat: point?.lat ?? null,
                    lng: point?.lng ?? null,
                    maps_url: detail?.maps_url
                        || (item.place_data?.url)
                        || mapsSearchUrl(item.location, item.place_id),
                    place_id: detail?.place_id || item.place_id || null,
                    website: detail?.website || null,
                    phone: detail?.phone || null,
                    // The old planner already stored a rating; keep it when
                    // there is no key to fetch a fresher one.
                    rating: detail?.rating ?? (typeof item.place_data?.rating === 'number' ? item.place_data.rating : null),
                    price_level: detail?.price_level ?? null,
                    hours: detail?.hours || null,
                    // Deliberately not reusing place_data.photos: those URLs
                    // carry the browser API key and an r_url of localhost:5173,
                    // so they are both leaky and already broken.
                    image_url: detail?.image_url || null,
                    status: 'been',
                    source: 'itinerary',
                };

                const { data: inserted, error: insertError } = await sb
                    .from('spots').insert([row]).select('id').single();

                if (insertError) {
                    // A unique place_id collision means another item in this
                    // same run already created it — find it and link instead.
                    const { data: found } = await sb
                        .from('spots').select('id').eq('user_id', userId)
                        .eq('place_id', row.place_id || '').maybeSingle();
                    if (!found) throw new Error(insertError.message);
                    spotId = found.id;
                } else {
                    spotId = inserted.id;
                    created += 1;
                }

                if (row.place_id) byPlaceId.set(row.place_id, spotId);
                byName.set(row.name.trim().toLowerCase(), spotId);

                await sleep(gap);
            }

            await sb.from('plan_items').update({ spot_id: spotId }).eq('id', item.id);
            linked += 1;
        } catch (err) {
            failures.push({ item: item.activity, error: err.message });
        }
    }

    const { count: remaining } = await sb
        .from('plan_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('spot_id', null)
        .not('location', 'is', null);

    return res.status(200).json({
        created,
        linked,
        remaining: remaining || 0,
        done: (remaining || 0) === 0,
        usingPlacesKey: hasKey,
        failures: failures.length ? failures : undefined,
    });
}
