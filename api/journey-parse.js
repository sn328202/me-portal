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
        number: { type: 'string', description: 'The flight or service number as printed, e.g. "BA 286", "9024", "AI 174". If this entry covers a connection the confirmation did not time separately, list them together: "LH 453 / LH 766".' },
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
        notes: { type: 'string', description: 'Anything else worth keeping. Lead with the stop if there is one ("1 stop: 22h 0m in MUC"), then seat, terminal, cabin, fare class, check-in window. Not a restatement of the fields above.' },
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

HOW MANY ENTRIES:
Split by what the confirmation TIMES, not by what it mentions.

- If it prints a departure and arrival time for each individual flight, make
  one entry per flight. SFO 09:00 to JFK 17:35, then JFK 19:15 to LHR 07:30,
  is two entries.
- If it prints only the two ends of a direction — "05:30 pm LAX to 11:55 pm
  BOM, 40h 55m, 1 Stop (MUC 22h 0m)" — that is ONE entry, LAX to BOM. The
  individual flights have no times printed anywhere, and inventing them would
  put departures on her calendar that are not on her ticket. List every flight
  number for that entry together in 'number' ("LH 453 / LH 766") and put the
  stop at the front of 'notes' ("1 stop: 22h 0m in MUC").
- A round trip is always at least two entries. Never drop the return.
- Layovers, ground time and self-transfer waits are never entries of their own.
- Order the entries as they are travelled, earliest departure first.

FINDING THE DATE:
The date is often nowhere near the time. Airline and travel-agency emails
routinely print the clock times in an itinerary block and the dates somewhere
else entirely — a trip header, a fare summary, or a cancellation-rules table
at the very bottom that reads "LAX to BOM   Wed, Dec 23, 2026 - Fri, Dec 25,
2026". Read the WHOLE email and match those by route. An entry you cannot
date is an entry that will be thrown away, so look before you give up.

ARRIVAL DATE NOTATION:
"+1", "(+1)", "next day", "arrives next day" mean the arrival is one calendar
day after the departure. "2nd day arrival" and "+2" mean two days after. A
range like "Wed, Dec 23, 2026 - Fri, Dec 25, 2026" for one direction means it
leaves on the 23rd and lands on the 25th.

TWELVE-HOUR CLOCKS:
"05:30 pm" is 17:30. "11:55 pm" is 23:55. "01:35 am" is 01:35. "12:15 am" is
00:15 and "12:15 pm" is 12:15. This is a change of notation, not of zone — the
clock is still the local one at that end.

Other rules:
- Report only what the confirmation states. A field you cannot find is left
  out, never guessed.
- The year matters. If a date is given without one, choose the year that puts
  the journey in the future relative to today's date, given below.
- 'duration' is only ever copied from the confirmation. If it does not state a
  flying time, leave it out. Do not subtract the two clocks — they are in
  different zones and subtracting them gives a number the ticket contradicts.
- The booking reference usually applies to every leg. Put it on each one.
- A single trip total goes on the first entry only, never repeated onto each.
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

/**
 * The legs, cleaned, deduplicated and in travel order — and a count of what
 * had to be thrown away.
 *
 * The count is the point. A leg with no date cannot be saved, but dropping it
 * without a word is how a four-leg booking becomes a two-leg one and nobody
 * finds out until the airport. She gets told how many did not survive, so a
 * confirmation this cannot read looks like a confirmation this cannot read.
 */
export const cleanLegs = (legs = []) => {
    const out = [];
    const seen = new Set();
    let dropped = 0;
    for (const raw of Array.isArray(legs) ? legs : []) {
        const leg = cleanLeg(raw);
        if (!leg) {
            /* Only count it as a loss if it was trying to be a leg. An entry
               naming a route or a flight number and lacking a date is a leg
               this could not read, and she should hear about it. An entry
               with neither — a layover the model volunteered despite being
               told not to — is noise, and warning her about noise trains her
               to ignore the warning that matters. */
            const named = ['from_place', 'to_place', 'carrier', 'number']
                .some((k) => String(raw?.[k] || '').trim());
            if (named) dropped += 1;
            continue;
        }
        /* The same flight listed twice — itineraries repeat themselves in a
           summary block at the bottom, and two identical rows in the review
           list is two identical journeys in her book. */
        const key = [leg.depart_date, leg.depart_time, leg.from_place, leg.to_place, leg.number]
            .join('|').toLowerCase();
        // A repeat of a leg already kept is not a loss — itineraries restate
        // themselves in a summary block — so it is not counted as dropped.
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(leg);
        if (out.length >= MAX_LEGS) break;
    }
    out.sort((a, b) => `${a.depart_date}T${a.depart_time}`.localeCompare(`${b.depart_date}T${b.depart_time}`));
    return { legs: out, dropped };
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
        const { legs, dropped } = cleanLegs(call?.input?.legs);

        if (!legs.length) {
            return res.status(200).json({
                ok: false,
                error: dropped
                    ? 'It found travel in there but no dates it could read. Check the email has the dates in it, or add this one by hand.'
                    : 'That does not look like a travel confirmation.',
            });
        }

        return res.status(200).json({ ok: true, legs, dropped });
    } catch (err) {
        console.error('journey-parse threw', err?.name, err?.message);
        return res.status(502).json({ error: 'Could not read that one.' });
    }
}
