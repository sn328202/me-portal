import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/journey-parse   { text: "<a pasted airline or rail confirmation>" }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Reads a booking confirmation and returns every leg it contains.
 *
 * Every leg, not one. A restaurant confirmation is one table; a flight
 * confirmation is routinely four — out via a connection, back via another —
 * and a parser that returns the first of them and drops the rest is a parser
 * that quietly loses the return leg of every trip she books.
 *
 * The one rule that matters more than all the others is at the top of the
 * system prompt: **do not convert the times.** A model asked to read
 * "departs 09:00 PDT, arrives 18:00 EDT" will helpfully normalise them if you
 * let it, and normalising is exactly the mistake this whole table was rebuilt
 * to stop making. What is printed on the ticket is the answer.
 *
 * Nothing is written here. It returns drafts, she reviews them, and she
 * presses save — because a flight on the wrong Tuesday that saved itself is
 * worse than no parser at all.
 */

export const config = { maxDuration: 30 };

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const MAX_TEXT = 20000;   // longer than a restaurant's: itineraries run long
const MAX_LEGS = 12;      // a booking with more legs than this is a mistake

const LEG = {
    type: 'object',
    properties: {
        mode: {
            type: 'string',
            description: 'How this leg travels.',
            enum: ['flight', 'train', 'bus', 'ferry', 'car', 'other'],
        },
        carrier: { type: 'string', description: 'The airline or operator, by name. "British Airways", not "BA" — unless the name is only ever written short, like "SNCF".' },
        number: { type: 'string', description: 'The flight or service number as printed, e.g. "BA 286", "9024", "AI 174".' },
        from_place: { type: 'string', description: 'Where this leg leaves from, as the ticket writes it — an airport code like "SFO" if that is what it says, a station name like "St Pancras" if that is.' },
        to_place: { type: 'string', description: 'Where this leg arrives, written the same way.' },
        depart_date: { type: 'string', description: 'Departure date as YYYY-MM-DD.' },
        depart_time: { type: 'string', description: 'Departure time as HH:MM on a 24-hour clock, EXACTLY as printed at the departure point. Never converted.' },
        arrive_date: { type: 'string', description: 'Arrival date as YYYY-MM-DD. Often the same as departure; for an overnight leg it is the next day, and the ticket will say so.' },
        arrive_time: { type: 'string', description: 'Arrival time as HH:MM on a 24-hour clock, EXACTLY as printed at the arrival point, in the arrival point’s own local time. Never converted.' },
        confirmation: { type: 'string', description: 'The booking reference, PNR or record locator. Usually the same across every leg of one booking.' },
        duration: { type: 'string', description: 'The flying or journey time as the confirmation prints it, e.g. "6h 05m". Only if it is stated — never worked out from the two times.' },
        cost: { type: 'number', description: 'What this leg cost, as a number. Only if the confirmation prices legs separately; a single trip total goes on the first leg alone.' },
        currency: { type: 'string', description: 'Three-letter code for that amount, e.g. USD, GBP, EUR, INR.' },
        baggage: { type: 'string', description: 'The allowance in the words the confirmation uses, e.g. "1 checked 23kg + cabin".' },
        notes: { type: 'string', description: 'Anything else worth keeping — seat number, terminal, cabin, check-in window, a layover warning. Not a restatement of the fields above.' },
    },
    required: ['mode', 'depart_date', 'depart_time'],
};

const SCHEMA = {
    name: 'journey',
    description: 'Every leg of travel described by this confirmation.',
    input_schema: {
        type: 'object',
        properties: {
            legs: {
                type: 'array',
                description: 'One entry per flight, train or crossing, in the order they are travelled. Empty if this is not a travel confirmation.',
                items: LEG,
            },
        },
        required: ['legs'],
    },
};

const SYSTEM = `You read travel booking confirmations — airline, rail, ferry, coach — and report what they say.

THE RULE THAT MATTERS MOST:
Never convert a time between zones. Report the departure time in the departure
point's own local clock and the arrival time in the arrival point's own local
clock, exactly as the confirmation prints them. A flight that leaves San
Francisco at 09:00 and lands in New York at 18:00 is depart_time "09:00" and
arrive_time "18:00" — not 12:00 and 18:00, and not 09:00 and 15:00. If the
confirmation labels the times with zones (PDT, EDT, GMT+1), that labelling is
your confirmation that they are already local. Strip the label and keep the
digits. Do not add an offset to anything.

Other rules:
- Report only what the confirmation states. A field you cannot find is left
  out, never guessed.
- ONE ENTRY PER SEGMENT. A round trip is two entries. A connection is two
  entries — SFO to JFK is one leg and JFK to LHR is another, each with its own
  flight number and its own two times. Never merge a connection into a single
  leg, and never drop the return.
- Order the legs as they are travelled, earliest departure first.
- Layovers, ground time and self-transfer waits are not legs. They are the gaps
  between legs, and they need no entry of their own.
- The year matters. If a date is given without one, choose the year that puts
  the journey in the future relative to today's date, given below.
- 'duration' is only ever copied from the confirmation. If it does not state a
  flying time, leave it out. Do not subtract the two clocks — they are in
  different zones and subtracting them gives a number the ticket contradicts.
- The booking reference usually applies to every leg. Put it on each one.
- If the text is not a travel confirmation at all, return an empty legs array.`;

/** A leg the form can actually use, or null. */
export const cleanLeg = (raw = {}) => {
    const str = (v) => {
        const s = String(v ?? '').trim();
        return s || null;
    };
    const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : null);
    const clock = (v) => {
        const m = /^(\d{1,2}):(\d{2})/.exec(String(v || '').trim());
        if (!m) return null;
        const h = Number(m[1]);
        const min = Number(m[2]);
        if (h > 23 || min > 59) return null;
        return `${String(h).padStart(2, '0')}:${m[2]}`;
    };

    const depart_date = day(raw.depart_date);
    const depart_time = clock(raw.depart_time);
    // A leg with no departure is not a leg. Everything else can be missing.
    if (!depart_date || !depart_time) return null;

    const MODES = ['flight', 'train', 'bus', 'ferry', 'car', 'other'];
    const mode = MODES.includes(raw.mode) ? raw.mode : 'flight';

    const arrive_time = clock(raw.arrive_time);
    // An arrival time with no date of its own is the same day it left, which is
    // true of most legs and is what the ticket means by leaving it off.
    const arrive_date = arrive_time ? (day(raw.arrive_date) || depart_date) : null;

    const amount = Number(raw.cost);
    const cost = Number.isFinite(amount) && amount > 0 ? amount : null;

    return {
        mode,
        carrier: str(raw.carrier),
        number: str(raw.number),
        from_place: str(raw.from_place),
        to_place: str(raw.to_place),
        depart_date,
        depart_time,
        arrive_date,
        arrive_time,
        confirmation: str(raw.confirmation),
        duration: str(raw.duration),
        cost,
        currency: cost ? (str(raw.currency)?.toUpperCase().slice(0, 3) || null) : null,
        baggage: str(raw.baggage),
        notes: str(raw.notes),
    };
};

/** The legs, cleaned, deduplicated and in travel order. */
export const cleanLegs = (legs = []) => {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(legs) ? legs : []) {
        const leg = cleanLeg(raw);
        if (!leg) continue;
        /* The same flight listed twice — itineraries repeat themselves in a
           summary block at the bottom, and two identical rows in the review
           list is two identical journeys in her book. */
        const key = [leg.depart_date, leg.depart_time, leg.from_place, leg.to_place, leg.number]
            .join('|').toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(leg);
        if (out.length >= MAX_LEGS) break;
    }
    return out.sort((a, b) => `${a.depart_date}T${a.depart_time}`.localeCompare(`${b.depart_date}T${b.depart_time}`));
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
                // Four legs of detail is a lot more than one table's worth.
                max_tokens: 4096,
                system: SYSTEM,
                tools: [SCHEMA],
                // It must fill the form in rather than describe the email.
                tool_choice: { type: 'tool', name: 'journey' },
                messages: [{
                    role: 'user',
                    content: `Today is ${new Date().toISOString().slice(0, 10)}.\n\n${text}`,
                }],
            }),
            signal: AbortSignal.timeout(25000),
        });

        if (!r.ok) {
            console.error('journey-parse: Anthropic', r.status, (await r.text()).slice(0, 300));
            return res.status(502).json({ error: 'Could not read that one.' });
        }

        const reply = await r.json();
        const call = (reply.content || []).find((c) => c.type === 'tool_use');
        const legs = cleanLegs(call?.input?.legs);

        if (!legs.length) {
            return res.status(200).json({ ok: false, error: 'That does not look like a travel confirmation.' });
        }

        return res.status(200).json({ ok: true, legs });
    } catch (err) {
        console.error('journey-parse threw', err?.name, err?.message);
        return res.status(502).json({ error: 'Could not read that one.' });
    }
}
