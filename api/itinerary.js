import { createClient } from '@supabase/supabase-js';
import { geocodeArea, distanceKm, nearbyPlaces, routeOrder, placeDetails } from './_place.js';

/**
 * POST /api/itinerary
 * Header: Authorization: Bearer <supabase access token>
 *
 *   { near: "Napa" }
 *       -> the area's centre and extent, every saved spot inside it sorted by
 *          distance, and more places nearby she has not saved
 *
 *   { build: { title, date, near, spotIds: [], newPlaces: [] } }
 *       -> a day_plan with plan_items ordered so the day does not criss-cross
 *
 * The radius comes from the place's own bounding box rather than a constant:
 * a neighbourhood is a ten minute walk and a wine region is an hour's drive,
 * and one fixed number is wrong for both.
 */

export const config = { maxDuration: 60 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const client = () => createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

/** Rough minutes between two stops: walking under a mile, driving beyond. */
const travelLeg = (km) => {
    if (km == null) return null;
    if (km <= 1.6) return { mode: 'walk', minutes: Math.max(1, Math.round((km / 4.8) * 60)), km: Math.round(km * 10) / 10 };
    return { mode: 'drive', minutes: Math.max(1, Math.round((km / 35) * 60)), km: Math.round(km * 10) / 10 };
};

/**
 * A spot with no coordinates can still belong to an area if its own text says
 * so — "Hayes Valley" typed into the city field is a real signal, and dropping
 * those would hide exactly the places saved in a hurry.
 */
const matchesByText = (spot, query) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return false;
    return [spot.city, spot.neighborhood, spot.address]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle));
};

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST with a session.' });
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Not configured.' });
    }

    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return res.status(401).json({ error: 'Sign in first.' });

    const sb = client();
    const { data: auth, error: authError } = await sb.auth.getUser(bearer);
    if (authError || !auth?.user) return res.status(401).json({ error: 'That session has expired.' });
    const userId = auth.user.id;

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    /* ---------- what have I saved near here? --------------------------- */

    if (body.near) {
        const area = await geocodeArea(body.near);
        if (!area) {
            return res.status(200).json({ ok: false, error: `Could not find anywhere called "${body.near}".` });
        }

        const { data: spots, error } = await sb
            .from('spots').select('*').eq('user_id', userId);
        if (error) return res.status(500).json({ error: error.message });

        const radius = Number(body.radiusKm) || area.radiusKm;

        const matched = (spots || [])
            .map((spot) => {
                const km = distanceKm(area, spot);
                return { ...spot, distanceKm: km == null ? null : Math.round(km * 10) / 10 };
            })
            .filter((spot) => (spot.distanceKm != null ? spot.distanceKm <= radius : matchesByText(spot, body.near)))
            .sort((a, b) => {
                // Located places first, nearest first; text-matched ones after,
                // since we cannot say how far away they are.
                if (a.distanceKm == null) return 1;
                if (b.distanceKm == null) return -1;
                return a.distanceKm - b.distanceKm;
            });

        // Only suggest places she has not already saved.
        const known = new Set((spots || []).map((s) => s.place_id).filter(Boolean));
        const knownNames = new Set((spots || []).map((s) => s.name.trim().toLowerCase()));
        const suggestions = (await nearbyPlaces({
            lat: area.lat, lng: area.lng, radiusKm: Math.min(radius, 15), keyword: body.keyword,
        })).filter((p) => !known.has(p.place_id) && !knownNames.has((p.name || '').trim().toLowerCase()));

        return res.status(200).json({
            ok: true,
            area: { ...area, radiusKm: radius },
            spots: matched,
            suggestions,
            // Said plainly so an empty suggestion list is not read as "nothing
            // exists near Napa".
            suggestionsAvailable: Boolean(process.env.GOOGLE_PLACES_API_KEY),
        });
    }

    /* ---------- build the day ------------------------------------------ */

    if (body.build) {
        const { title, date, near, spotIds = [], newPlaces = [] } = body.build;

        // Save anything chosen from the suggestions, so a place picked for a
        // day is in the library from then on.
        const createdSpotIds = [];
        for (const place of newPlaces.slice(0, 20)) {
            if (!place?.place_id && !place?.name) continue;
            const detail = place.place_id ? await placeDetails(place.place_id) : null;
            const row = {
                user_id: userId,
                name: detail?.name || place.name,
                category: detail?.category || place.category || null,
                address: detail?.address || place.address || null,
                neighborhood: detail?.neighborhood || null,
                city: detail?.city || null,
                lat: detail?.lat ?? place.lat ?? null,
                lng: detail?.lng ?? place.lng ?? null,
                maps_url: detail?.maps_url || place.maps_url || null,
                place_id: detail?.place_id || place.place_id || null,
                rating: detail?.rating ?? place.rating ?? null,
                price_level: detail?.price_level ?? place.price_level ?? null,
                hours: detail?.hours || null,
                image_url: detail?.image_url || place.image_url || null,
                website: detail?.website || null,
                phone: detail?.phone || null,
                status: 'want to go',
                source: 'itinerary',
            };
            const { data, error } = await sb.from('spots').insert([row]).select('id').single();
            if (!error && data) createdSpotIds.push(data.id);
        }

        const allIds = [...new Set([...spotIds, ...createdSpotIds])];
        if (!allIds.length) return res.status(400).json({ error: 'No places chosen.' });

        const { data: chosen, error: chosenError } = await sb
            .from('spots').select('*').eq('user_id', userId).in('id', allIds);
        if (chosenError) return res.status(500).json({ error: chosenError.message });

        const ordered = routeOrder(chosen || []);

        const { data: plan, error: planError } = await sb
            .from('day_plans')
            .insert([{
                user_id: userId,
                title: title || `A day in ${near || 'town'}`,
                location: near || null,
                planned_date: date || null,
            }])
            .select('id, title')
            .single();
        if (planError) return res.status(500).json({ error: planError.message });

        const legs = [];
        const rows = ordered.map((spot, i) => {
            const leg = i === 0 ? null : travelLeg(distanceKm(ordered[i - 1], spot));
            if (leg) legs.push({ from: ordered[i - 1].name, to: spot.name, ...leg });
            return {
                plan_id: plan.id,
                spot_id: spot.id,
                user_id: userId,
                activity: spot.name,
                location: spot.address || spot.neighborhood || spot.city || null,
                link: spot.maps_url || null,
                notes: [spot.why, leg ? `${leg.minutes} min ${leg.mode} from ${ordered[i - 1].name}` : null]
                    .filter(Boolean).join(' — ') || null,
                is_brainstorm: true,
                sort_order: i,
            };
        });

        const { error: itemsError } = await sb.from('plan_items').insert(rows);
        if (itemsError) return res.status(500).json({ error: itemsError.message });

        return res.status(200).json({
            ok: true,
            planId: plan.id,
            title: plan.title,
            stops: ordered.map((s, i) => ({ order: i, name: s.name, id: s.id })),
            legs,
            totalKm: Math.round(legs.reduce((sum, l) => sum + (l.km || 0), 0) * 10) / 10,
            savedNew: createdSpotIds.length,
        });
    }

    return res.status(400).json({ error: 'Send either { near } or { build }.' });
}
