import { createClient } from '@supabase/supabase-js';
import { looksLikeToken, readTrip } from './_share.js';

/**
 * GET /api/share?token=<token>
 *
 * A trip, to somebody who has the link and no account.
 *
 * The whole point is that this endpoint is unauthenticated, so the token is
 * the only thing standing between a stranger and a trip. Three things make
 * that hold:
 *
 *   1. The token is 32 random bytes. Not a trip id, not a slug, not anything
 *      you can arrive at by counting.
 *   2. `trip_shares` grants nothing to `anon` at all — the browser's own
 *      client cannot read the table, so nobody can list tokens to find one
 *      that works. Only this file, holding the service key, can look one up.
 *   3. Every read is scoped by both the trip and its owner. See `_share.js`,
 *      where that is a test rather than a comment.
 *
 * RLS is untouched. The anon key still sees nothing. This is a door with a
 * lock on it rather than a wall with a hole in it.
 */

export const config = { maxDuration: 15 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

export default async function handler(req, res) {
    // A shared trip changes while people are looking at it. Never let a CDN
    // hold yesterday's copy of somebody's plan.
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') return res.status(405).json({ error: 'GET a share token.' });
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.' });
    }

    const token = (req.query?.token || '').toString().trim();
    // The same answer for "badly formed", "never existed" and "revoked". A
    // different one for each is a way of telling a stranger which guesses were
    // close.
    const gone = () => res.status(404).json({ error: 'That link is not valid any more.' });
    if (!looksLikeToken(token)) return gone();

    const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });

    const { data: share, error: shareError } = await sb
        .from('trip_shares')
        .select('token, trip_id, user_id, can_edit, revoked_at, views')
        .eq('token', token)
        .maybeSingle();

    if (shareError) return res.status(500).json({ error: 'Could not read that link.' });
    if (!share || share.revoked_at) return gone();

    const bundle = await readTrip(sb, share);
    if (!bundle) return gone();

    /* Seen. Read-modify-write, so two people opening the link in the same
       second can land on the same number — a view counter is not a ledger and
       an RPC to make it exact is more surface than the fact is worth. Not
       worth failing the request over either, and not worth waiting for. */
    sb.from('trip_shares')
        .update({ views: (share.views || 0) + 1, last_seen_at: new Date().toISOString() })
        .eq('token', token)
        .then(() => {}, () => {});

    return res.status(200).json(bundle);
}
