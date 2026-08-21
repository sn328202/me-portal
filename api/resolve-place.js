import { createClient } from '@supabase/supabase-js';
import { resolvePlace } from './_place.js';

/**
 * POST /api/resolve-place   { name: "...", city?: "..." }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Lets the Spots tab add a place by name and get back everything the voice
 * capture would have found. Authenticated by the caller's own session, since
 * the Places key must not reach the browser.
 */

export const config = { maxDuration: 30 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST a place name.' });
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.' });
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
    const name = (body.name || '').toString().trim();
    if (!name) return res.status(400).json({ error: 'No place given.' });

    // resolvePlace never throws — an unresolvable name still comes back with
    // a map search link, which is better than an error.
    const place = await resolvePlace(name, { city: (body.city || '').toString().trim() || null });
    return res.status(200).json({ ok: true, place });
}
