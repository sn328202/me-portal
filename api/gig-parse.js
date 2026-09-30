import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/gig-parse   { text: "<a pasted concert ticket confirmation>" }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Reads a Ticketmaster / AXS / Dice / venue confirmation and returns every
 * show on it — usually one, but a festival pass or a two-night run is several.
 *
 * Nothing is written here. It returns drafts and she saves them.
 */

export const config = { maxDuration: 30 };

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const MAX_TEXT = 20000;
const MAX_GIGS = 8;

const GIG = {
    type: 'object',
    properties: {
        name: { type: 'string', description: 'The headliner or event name as billed, e.g. "Phoebe Bridgers" or "Outside Lands — Day 2".' },
        support: { type: 'string', description: 'Opening acts or special guests, if listed.' },
        venue: { type: 'string', description: 'The venue name, e.g. "The Fillmore".' },
        city: { type: 'string', description: 'The city the venue is in.' },
        date: { type: 'string', description: 'Show date as YYYY-MM-DD.' },
        time: { type: 'string', description: 'Show / event start time as HH:MM on a 24-hour clock, exactly as printed. Never converted between zones.' },
        doors: { type: 'string', description: 'Doors-open time as HH:MM on a 24-hour clock, only if printed.' },
        section: { type: 'string', description: 'Section or area, e.g. "104", "GA Floor", "Balcony".' },
        row: { type: 'string', description: 'Row, if printed.' },
        seat: { type: 'string', description: 'Seat number or range as printed, e.g. "12" or "12-13".' },
        tickets: { type: 'integer', description: 'How many tickets this order holds for this show.' },
        cost: { type: 'number', description: 'Order total for this show including fees, as a number. For a multi-show order with a single total, put it on the first show only.' },
        currency: { type: 'string', description: 'Three-letter currency code, e.g. USD.' },
        seller: { type: 'string', description: 'Who sold the ticket, e.g. "Ticketmaster", "AXS", "Dice", "SeatGeek", or the venue.' },
        ticket_link: { type: 'string', description: 'A URL to view or manage the tickets, if the text contains one.' },
        confirmation: { type: 'string', description: 'The order number or confirmation code.' },
        notes: { type: 'string', description: 'Anything else worth keeping: mobile-ticket or will-call instructions, age limit, bag policy, parking. Not a restatement of the fields above.' },
    },
    required: ['name', 'date'],
};

const SCHEMA = {
    name: 'gigs',
    description: 'Every show on this ticket confirmation.',
    input_schema: {
        type: 'object',
        properties: {
            gigs: {
                type: 'array',
                description: 'One entry per show date. Empty if this is not a ticket confirmation.',
                items: GIG,
            },
        },
        required: ['gigs'],
    },
};

const SYSTEM = `You read concert and live-event ticket confirmations and report what they say.

- Times are the venue's local clock, exactly as printed. Never convert between
  zones. "8:00 PM CT" is time "20:00". "Doors 7pm / Show 8pm" is doors "19:00",
  time "20:00". If only one time is printed and it is labelled doors, put it in
  doors and leave time out.
- One entry per show date. A two-night run bought in one order is two entries.
  A festival pass valid for three days is three entries.
- Report only what the confirmation states. A field you cannot find is left
  out, never guessed.
- If a date is given without a year, choose the year that puts the show in the
  future relative to today's date, given below.
- If the text is not a ticket confirmation at all, return an empty array.`;

/** A show the form can use, or null. */
export const cleanGig = (raw = {}) => {
    const str = (v) => {
        const s = String(v ?? '').trim();
        return s || null;
    };
    const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : null);
    const clock = (v) => {
        const m = /^(\d{1,2}):(\d{2})/.exec(String(v || '').trim());
        if (!m) return null;
        const h = Number(m[1]);
        if (h > 23 || Number(m[2]) > 59) return null;
        return `${String(h).padStart(2, '0')}:${m[2]}`;
    };

    const name = str(raw.name);
    const date = day(raw.date);
    if (!name || !date) return null;

    const doors = clock(raw.doors);
    const amount = Number(raw.cost);
    const cost = Number.isFinite(amount) && amount > 0 ? amount : null;
    const count = Number.parseInt(raw.tickets, 10);
    const link = str(raw.ticket_link);

    return {
        name,
        support: str(raw.support),
        venue: str(raw.venue),
        city: str(raw.city),
        date,
        // No show time but doors: the show is after doors, and doors are
        // what she plans around, so the doors time stands in.
        time: clock(raw.time) || doors || null,
        doors,
        section: str(raw.section),
        row: str(raw.row),
        seat: str(raw.seat),
        tickets: Number.isFinite(count) && count > 0 ? count : null,
        cost,
        currency: cost ? (str(raw.currency)?.toUpperCase().slice(0, 3) || null) : null,
        seller: str(raw.seller),
        ticket_link: link && /^https?:\/\//i.test(link) ? link : null,
        confirmation: str(raw.confirmation),
        notes: str(raw.notes),
    };
};

/** Cleaned, deduplicated, in date order, with a count of what was unreadable. */
export const cleanGigs = (list = []) => {
    const out = [];
    const seen = new Set();
    let dropped = 0;
    for (const raw of Array.isArray(list) ? list : []) {
        const gig = cleanGig(raw);
        if (!gig) {
            if (String(raw?.name || raw?.venue || '').trim()) dropped += 1;
            continue;
        }
        const key = [gig.date, gig.time, gig.name].join('|').toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(gig);
        if (out.length >= MAX_GIGS) break;
    }
    out.sort((a, b) => `${a.date}T${a.time || ''}`.localeCompare(`${b.date}T${b.time || ''}`));
    return { gigs: out, dropped };
};

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST a confirmation.' });
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'Not configured: ANTHROPIC_API_KEY.' });
    }
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
    const text = String(body.text || '').trim().slice(0, MAX_TEXT);
    if (text.length < 20) return res.status(400).json({ error: 'Paste the whole confirmation.' });

    try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 2048,
                system: SYSTEM,
                tools: [SCHEMA],
                tool_choice: { type: 'tool', name: 'gigs' },
                messages: [{
                    role: 'user',
                    content: `Today is ${new Date().toISOString().slice(0, 10)}.\n\n${text}`,
                }],
            }),
            signal: AbortSignal.timeout(25000),
        });

        if (!r.ok) {
            console.error('gig-parse: Anthropic', r.status, (await r.text()).slice(0, 300));
            return res.status(502).json({ error: 'Could not read that one.' });
        }

        const reply = await r.json();
        const call = (reply.content || []).find((c) => c.type === 'tool_use');
        const { gigs, dropped } = cleanGigs(call?.input?.gigs);

        if (!gigs.length) {
            return res.status(200).json({
                ok: false,
                error: dropped
                    ? 'It found a show in there but no date it could read. Add this one by hand.'
                    : 'That does not look like a ticket confirmation.',
            });
        }
        return res.status(200).json({ ok: true, gigs, dropped });
    } catch (err) {
        console.error('gig-parse threw', err?.name, err?.message);
        return res.status(502).json({ error: 'Could not read that one.' });
    }
}
