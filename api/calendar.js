import { createClient } from '@supabase/supabase-js';
import { parseCalendar, isFreeBusyOnly } from './_ics.js';
import { isPrivateHost, UA } from './_html.js';

/**
 * POST /api/calendar
 * Header: Authorization: Bearer <supabase access token>
 *
 *   { }                      -> events from every saved feed
 *   { probe: "https://..." } -> fetch one feed and describe it, without saving
 *
 * Why this exists at all: the Google Calendar embed can only show what the
 * calendar is shared as. Neha's is shared "free/busy only", so all 227 of its
 * events are titled "Busy" and no amount of front-end work can recover the
 * titles. The calendar's *secret address* returns full detail without making
 * anything public — but it is a secret, so it cannot be handed to a public
 * CORS proxy, which is what the old client-side path did.
 *
 * Everything happens here: the browser sends a session, receives events.
 */

export const config = { maxDuration: 30 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const DAY = 86400000;
const LOOK_BACK_DAYS = 7;
const LOOK_AHEAD_DAYS = 90;
const MAX_FEEDS = 12;
const MAX_BYTES = 5_000_000;

/** webcal:// is just https:// wearing a hat. */
const normalise = (raw) => {
    let url = String(raw || '').trim();
    if (url.startsWith('webcal://')) url = `https://${url.slice('webcal://'.length)}`;
    return url;
};

const fetchFeed = async (rawUrl) => {
    const url = normalise(rawUrl);

    let target;
    try {
        target = new URL(url);
    } catch {
        throw new Error('that is not a valid calendar address');
    }
    if (!/^https?:$/.test(target.protocol)) throw new Error('only http and https addresses work');
    // This function fetches a URL chosen by the caller from inside Vercel's
    // network; refuse anything pointing back at private space.
    if (isPrivateHost(target.hostname)) throw new Error('that address is not reachable');

    const res = await fetch(target.toString(), {
        redirect: 'follow',
        headers: { 'user-agent': UA, accept: 'text/calendar,text/plain,*/*' },
        signal: AbortSignal.timeout(15000),
    });

    if (res.status === 404) throw new Error('no calendar at that address — check the secret address is still valid');
    if (res.status === 401 || res.status === 403) throw new Error('that calendar refused access');
    if (!res.ok) throw new Error(`the calendar server answered ${res.status}`);

    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('that calendar is too large to read');
    if (!text.includes('BEGIN:VCALENDAR')) {
        throw new Error('that address did not return a calendar — it may be the web link rather than the iCal address');
    }
    return text;
};

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST with a session.' });
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
        return res.status(401).json({ error: 'That session has expired — sign in again.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const now = Date.now();
    const from = now - LOOK_BACK_DAYS * DAY;
    const to = now + LOOK_AHEAD_DAYS * DAY;

    // --- probe: check one address before she commits to saving it ---------
    if (body.probe) {
        try {
            const text = await fetchFeed(body.probe);
            const { calendarName, events } = parseCalendar(text, { from, to });
            return res.status(200).json({
                ok: true,
                calendarName,
                eventCount: events.length,
                // The whole reason we are here. Say it plainly rather than
                // letting her wonder where the titles went.
                freeBusyOnly: isFreeBusyOnly(events),
                sample: events.slice(0, 3).map((e) => ({ title: e.title, start: e.start })),
            });
        } catch (err) {
            return res.status(200).json({ ok: false, error: err.message });
        }
    }

    // --- the real thing: every saved feed ---------------------------------
    const { data: config, error: configError } = await sb
        .from('user_portal_config')
        .select('settings')
        .eq('user_id', auth.user.id)
        .maybeSingle();

    if (configError) return res.status(500).json({ error: configError.message });

    const feeds = Array.isArray(config?.settings?.calendarFeeds)
        ? config.settings.calendarFeeds.slice(0, MAX_FEEDS)
        : [];

    if (!feeds.length) return res.status(200).json({ events: [], feeds: [], from, to });

    // One slow calendar should not hold up the rest.
    const results = await Promise.all(feeds.map(async (feed) => {
        try {
            const text = await fetchFeed(feed.url);
            const { calendarName, events } = parseCalendar(text, {
                from, to, source: feed.name || calendarNameFallback(feed), color: feed.color || null,
            });
            return {
                feed: { id: feed.id, name: feed.name || calendarName, color: feed.color || null, ok: true, count: events.length },
                events,
            };
        } catch (err) {
            return {
                feed: { id: feed.id, name: feed.name || 'Calendar', color: feed.color || null, ok: false, error: err.message },
                events: [],
            };
        }
    }));

    const events = results.flatMap((r) => r.events).sort((a, b) => new Date(a.start) - new Date(b.start));

    return res.status(200).json({
        events,
        feeds: results.map((r) => r.feed),
        from,
        to,
    });
}

/** A readable label when she never named the feed. */
function calendarNameFallback(feed) {
    try {
        return new URL(normalise(feed.url)).hostname.replace(/^www\./, '');
    } catch {
        return 'Calendar';
    }
}
