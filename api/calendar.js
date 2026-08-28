import { createClient } from '@supabase/supabase-js';
import { parseCalendar, isFreeBusyOnly } from './_ics.js';
import { isPrivateHost, UA } from './_html.js';
import { itineraryEvents, tripEvents, within } from '../src/utils/portalEvents.js';

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

    /* The portal's own days, alongside whatever calendars she subscribes to.

       This is the answer to "export the itinerary to my calendar", and it is
       not an export. A file goes stale the moment the plan changes, and
       writing into Google Calendar would mean asking for a write scope for
       something that only ever needed to be read. The Chronometer already
       merges sources; the portal is the one source that needs no address, no
       fetch and no permission — same database, same user, one query. Change
       an itinerary and this shows the change, because there is no copy. */
    const mine = config?.settings?.portalCalendar || {};
    /* Her zone, sent by the browser. The portal stores wall-clock times with
       no zone — "lunch at eleven" is eleven wherever you are standing — and
       this function runs on Vercel, which is UTC. Without this an eleven
       o'clock lunch arrived in the agenda at four in the morning. */
    const zone = typeof body.zone === 'string' && body.zone.length < 64 ? body.zone : null;
    const wantPlans = mine.itineraries !== false;
    const wantTrips = mine.trips !== false;

    const own = [];
    const ownFeeds = [];

    if (wantPlans) {
        try {
            const { data: plans } = await sb.from('day_plans')
                .select('id, title, planned_date, archived_at')
                .eq('user_id', auth.user.id)
                .not('planned_date', 'is', null);

            const ids = (plans || []).map((p) => p.id);
            const { data: items } = ids.length
                ? await sb.from('plan_items')
                    .select('id, plan_id, activity, start_time, location, is_brainstorm')
                    .in('plan_id', ids)
                : { data: [] };

            const byPlan = {};
            for (const i of items || []) (byPlan[i.plan_id] ||= []).push(i);

            const built = within(
                itineraryEvents(plans || [], byPlan, { color: 'var(--accent-gold)', zone }),
                from, to
            );
            own.push(...built);
            ownFeeds.push({ id: 'portal-itineraries', name: 'Your itineraries', color: 'var(--accent-gold)', ok: true, count: built.length, builtIn: true });
        } catch (err) {
            ownFeeds.push({ id: 'portal-itineraries', name: 'Your itineraries', ok: false, error: err.message, builtIn: true });
        }
    }

    if (wantTrips) {
        try {
            const { data: trips } = await sb.from('atlas_trips')
                .select('id, destination, start_date, end_date')
                .eq('user_id', auth.user.id);

            const ids = (trips || []).map((t) => t.id);
            const { data: days } = ids.length
                ? await sb.from('atlas_days').select('id, trip_id, date, city').in('trip_id', ids)
                : { data: [] };
            const dayIds = (days || []).map((d) => d.id);
            const { data: items } = dayIds.length
                ? await sb.from('atlas_day_items')
                    .select('id, day_id, title, start_time, end_time, location')
                    .in('day_id', dayIds)
                : { data: [] };

            const byTrip = {};
            for (const d of days || []) (byTrip[d.trip_id] ||= []).push(d);
            const byDay = {};
            for (const i of items || []) (byDay[i.day_id] ||= []).push(i);

            const built = within(
                tripEvents(trips || [], byTrip, byDay, { color: 'var(--accent-crimson)', zone }),
                from, to
            );
            own.push(...built);
            ownFeeds.push({ id: 'portal-trips', name: 'Your trips', color: 'var(--accent-crimson)', ok: true, count: built.length, builtIn: true });
        } catch (err) {
            ownFeeds.push({ id: 'portal-trips', name: 'Your trips', ok: false, error: err.message, builtIn: true });
        }
    }

    if (!feeds.length) {
        return res.status(200).json({
            events: own.sort((a, b) => new Date(a.start) - new Date(b.start)),
            feeds: ownFeeds,
            from,
            to,
        });
    }

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

    const events = [...own, ...results.flatMap((r) => r.events)]
        .sort((a, b) => new Date(a.start) - new Date(b.start));

    return res.status(200).json({
        events,
        // The portal's own sources first: they are always there and always
        // work, so they are the stable part of the list.
        feeds: [...ownFeeds, ...results.map((r) => r.feed)],
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
