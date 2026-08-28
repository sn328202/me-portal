import { createClient } from '@supabase/supabase-js';
import { searchPlaces } from './_place.js';

/**
 * POST /api/place-search   { q: "masque", city?: "Mumbai", limit?: 6 }
 * Header: Authorization: Bearer <supabase access token>
 *
 * The menu behind an @-mention. Separate from /api/resolve-place because that
 * one answers "what is this place" and returns the single best match — right
 * when the name is already decided, useless when the whole point is to choose
 * between candidates.
 *
 * Server-side because the Places key must never reach the browser, and
 * authenticated by the caller's own session so it is not an open proxy to a
 * billed API.
 */

export const config = { maxDuration: 15 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST a query.' });
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Not configured.' });
    }

    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return res.status(401).json({ error: 'Sign in first.' });

    const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await sb.auth.getUser(bearer);
    if (authError || !auth?.user) {
        return res.status(401).json({ error: 'That session is not valid any more — sign in again.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const q = (body.q || '').toString().trim();
    // Two characters is where a search stops being a list of everything.
    if (q.length < 2) return res.status(200).json({ ok: true, places: [] });

    const places = await searchPlaces(q, {
        city: (body.city || '').toString().trim() || null,
        limit: Number(body.limit) || 6,
    });

    return res.status(200).json({ ok: true, places });
}
