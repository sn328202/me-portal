import { createClient } from '@supabase/supabase-js';
import { extractProduct } from './_link.js';

/**
 * POST /api/link-preview   { url: "..." }
 * Header: Authorization: Bearer <supabase access token>
 *
 * What the Treasury's Auto-Fill button calls. It used to call api.microlink.io
 * straight from the browser, which returns title/image/description only — the
 * price was then guessed by regex over the description, which rarely found one
 * — on a free tier of roughly fifty requests a day.
 *
 * Authenticated by the caller's own Supabase session rather than a shared
 * secret, because a secret shipped to the browser is not a secret.
 */

export const config = { maxDuration: 30 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST a url to read.' });
    }
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
    const url = (body.url || '').toString().trim();
    if (!url) return res.status(400).json({ error: 'No link given.' });

    try {
        const product = await extractProduct(url);
        return res.status(200).json({ ok: true, product });
    } catch (err) {
        // A readable clause, because the Treasury shows it to her directly.
        return res.status(200).json({ ok: false, error: err.message || 'the page could not be read' });
    }
}
