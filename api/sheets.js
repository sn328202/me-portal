import { createClient } from '@supabase/supabase-js';
import { buildXlsx, readXlsx } from './_xlsx.js';

/**
 * The trip, as an actual spreadsheet file — both directions.
 *
 * The first version of this talked to an Apps Script she deployed under her own
 * Google account. Google refused to authorise it: not the usual "unverified
 * app, continue anyway" interstitial but a flat block with no way past it,
 * because the script wanted Drive and Sheets scopes. Getting round that means a
 * Cloud Console project and an OAuth consent screen, which is a far bigger
 * thing than the feature it was serving.
 *
 * A file needs nobody's permission. Google Sheets opens an .xlsx dropped into
 * Drive as a normal sheet, merges and all, and exports one back out through
 * File → Download. So the round trip is the same round trip; only the transport
 * changed, and this end of it can no longer be blocked by an account policy.
 *
 * Done on the server so a spreadsheet writer does not land in the browser
 * bundle for a feature used once a trip. The writing and reading themselves
 * live in ./_xlsx.js, by hand, because the library that was doing it hung on
 * import under Node 23 — see the note at the top of that file.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

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

    try {
        if (body.action === 'export') {
            const file = Buffer.from(buildXlsx(body)).toString('base64');
            return res.status(200).json({ file, filename: `${(body.title || 'Itinerary').replace(/[^\w\s-]/g, '').trim() || 'Itinerary'}.xlsx` });
        }
        if (body.action === 'import') {
            if (!body.file) return res.status(400).json({ error: 'No file came through.' });
            const result = readXlsx(Buffer.from(body.file, 'base64'));
            if (!result.tabs.length) return res.status(400).json({ error: 'That file has no sheets in it.' });
            return res.status(200).json(result);
        }
        return res.status(400).json({ error: `Unknown action: ${body.action}` });
    } catch (err) {
        // A .numbers or an old .xls arrives here rather than as a crash.
        return res.status(400).json({
            error: /zip|signature|corrupt|end of central/i.test(String(err.message))
                ? 'That does not look like an .xlsx. In Google Sheets: File → Download → Microsoft Excel.'
                : err.message,
        });
    }
}
