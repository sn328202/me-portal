import { createClient } from '@supabase/supabase-js';

/**
 * The relay between Me Portal and her own Apps Script.
 *
 * The script is deployed under her Google account and does the actual writing,
 * which is the whole point: no OAuth client, no API key, nothing of Google's
 * held by this app. But the browser cannot talk to it directly — an Apps Script
 * /exec answers a cross-origin POST with a redirect to googleusercontent, and
 * a redirected preflight is not something fetch will follow from a page.
 *
 * So this forwards it. Doing so server-side also means the shared secret is
 * sent from a server rather than sitting in a request the browser's network
 * tab shows to anyone standing behind her, and it means one place to enforce
 * that the caller is signed in at all.
 *
 * It deliberately understands nothing about itineraries. The grid is built and
 * read in src/utils/tripSheet.js, where there are tests.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

/** Apps Script answers /exec with a 302 to googleusercontent.com. */
const isAppsScript = (url) => {
    try {
        const { protocol, hostname } = new URL(url);
        return protocol === 'https:' && hostname === 'script.google.com';
    } catch {
        return false;
    }
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

    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return res.status(401).json({ error: 'Sign in first.' });
    const { data: auth, error: authError } = await sb.auth.getUser(bearer);
    if (authError || !auth?.user) return res.status(401).json({ error: 'That session has expired.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { endpoint, secret, action, ...rest } = body;

    if (!endpoint) {
        return res.status(400).json({
            error: 'No Apps Script URL saved yet — add one in Settings → Google Sheets.',
        });
    }
    // Only her own script, and only over https. Without this the endpoint field
    // is a request-forwarder pointed at anything the caller likes.
    if (!isAppsScript(endpoint)) {
        return res.status(400).json({ error: 'That URL is not a script.google.com deployment.' });
    }
    if (action !== 'export' && action !== 'import') {
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    try {
        const upstream = await fetch(endpoint, {
            method: 'POST',
            // Apps Script treats application/json as a preflighted request and
            // text/plain as a simple one; the script parses postData either way.
            headers: { 'content-type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, secret, ...rest }),
            redirect: 'follow',
        });

        const text = await upstream.text();

        let result;
        try {
            result = JSON.parse(text);
        } catch {
            // Apps Script serves its own HTML error pages, and dumping one into
            // a toast helps nobody. The two that actually happen get named.
            if (/Authorization|Sign in/i.test(text)) {
                return res.status(502).json({
                    error: 'The script asked for a sign-in — redeploy it with "Who has access: Anyone".',
                });
            }
            return res.status(502).json({
                error: 'The script answered with something that was not JSON. Has it been deployed as a Web app?',
            });
        }

        if (result.error) return res.status(400).json({ error: result.error });
        return res.status(200).json(result);
    } catch (err) {
        return res.status(502).json({ error: `Could not reach the script: ${err.message}` });
    }
}
