import { createClient } from '@supabase/supabase-js';
import { LEG, SYSTEM as JOURNEY_RULES, cleanLegs } from './journey-parse.js';
import { GIG, SYSTEM as GIG_RULES, cleanGigs } from './gig-parse.js';

/**
 * POST /api/booking-parse   { text: "<any pasted booking confirmation>" }
 * Header: Authorization: Bearer <supabase access token>
 *
 * One paste box for every kind of booking. Reads the confirmation, decides
 * what each thing in it is — a table or other timed booking, a flight or
 * train, a concert, a hotel — and returns them sorted into those four shapes.
 * One email can hold more than one kind (a hotel package with a dinner, a
 * flight booking with a car), so all four lists can come back filled.
 *
 * Nothing is written here. She reviews the list and saves.
 */

export const config = { maxDuration: 40 };

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const MAX_TEXT = 20000;
const TABLE_KINDS = ['table', 'tasting', 'activity', 'show', 'other'];

const TABLE = {
    type: 'object',
    properties: {
        kind: {
            type: 'string',
            enum: TABLE_KINDS,
            description: 'table = restaurant or bar; tasting = winery or tasting room; activity = tour, class, spa, museum slot, excursion; show = theatre, comedy, sports or anything seated that is not a concert; other = anything else with a time.',
        },
        name: { type: 'string', description: 'The name of the place or experience alone, no platform name. "Your table at Masque is confirmed" is "Masque".' },
        date: { type: 'string', description: 'YYYY-MM-DD.' },
        time: { type: 'string', description: 'HH:MM, 24-hour, local to the venue. Never converted.' },
        party_size: { type: 'integer' },
        platform: { type: 'string', enum: ['OpenTable', 'Resy', 'Tock', 'Yelp', 'Google', 'SevenRooms', 'Direct', 'Other'] },
        confirmation: { type: 'string' },
        seating: { type: 'string', description: 'Only if stated.' },
        city: { type: 'string' },
        address: { type: 'string' },
        phone: { type: 'string' },
        notes: { type: 'string', description: 'Deposit, cancellation deadline and fee, dress code — anything worth keeping.' },
    },
    required: ['name'],
};

const STAY = {
    type: 'object',
    properties: {
        name: { type: 'string', description: 'The hotel, rental or property name, e.g. "Hotel Emma" or "Airbnb — Loft in Shoreditch".' },
        address: { type: 'string' },
        city: { type: 'string' },
        check_in: { type: 'string', description: 'Check-in date as YYYY-MM-DD.' },
        check_out: { type: 'string', description: 'Check-out date as YYYY-MM-DD.' },
        cost: { type: 'number', description: 'Total for the stay including taxes and fees, if stated.' },
        currency: { type: 'string', description: 'Three-letter code.' },
        confirmation: { type: 'string' },
        link: { type: 'string', description: 'A URL to manage the booking, if present.' },
        notes: { type: 'string', description: 'Room type, check-in and check-out times, cancellation deadline, what is included.' },
    },
    required: ['name', 'check_in', 'check_out'],
};

const SCHEMA = {
    name: 'bookings',
    description: 'Every booking in this confirmation, sorted by what it is.',
    input_schema: {
        type: 'object',
        properties: {
            tables: { type: 'array', items: TABLE, description: 'Restaurants, tastings, tours, activities, shows that are not concerts.' },
            journeys: { type: 'array', items: LEG, description: 'Flights, trains, buses, ferries, car transfers.' },
            gigs: { type: 'array', items: GIG, description: 'Concerts, DJ sets, music festivals.' },
            stays: { type: 'array', items: STAY, description: 'Hotels, rentals, any overnight accommodation.' },
        },
        required: ['tables', 'journeys', 'gigs', 'stays'],
    },
};

export const SYSTEM = `You read booking confirmations of any kind and sort what they contain.

Decide what each booking is and put it in exactly one list:
- stays: anything you sleep in — hotel, Airbnb, hostel, rental, ryokan. One entry per property per continuous stay.
- journeys: anything that moves you between places — flight, train, bus, ferry, car transfer.
- gigs: live music — concerts, DJ sets, music festivals.
- tables: everything else with a time — restaurants, bars, tastings, tours, classes, spa, museum slots, theatre, comedy, sports.

One email can contain several kinds; fill every list that applies and leave
the others empty. If the text is not a booking at all, return all four empty.

Report only what the confirmation states. Never guess a field. Times are
always the local clock at that place, exactly as printed — never convert
between zones. If a date has no year, choose the year that puts it in the
future relative to today's date, given below.

Rules for journeys, which are the easiest to get wrong:
${JOURNEY_RULES.split('\n').slice(1).join('\n')}

Rules for gigs:
${GIG_RULES.split('\n').slice(1).join('\n')}`;

const str = (v) => {
    const s = String(v ?? '').trim();
    return s || null;
};
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : null);
const clock = (v) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(v || '').trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
    return `${m[1].padStart(2, '0')}:${m[2]}`;
};
const money = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
};
const web = (v) => {
    const s = str(v);
    return s && /^https?:\/\/\S+$/i.test(s) ? s : null;
};

/** A restaurant or other timed booking, or null. */
export const cleanTable = (raw = {}) => {
    const name = str(raw.name || raw.restaurant);
    const date = day(raw.date);
    if (!name || !date) return null;
    const size = Number.parseInt(raw.party_size, 10);
    return {
        kind: TABLE_KINDS.includes(raw.kind) ? raw.kind : 'other',
        name,
        date,
        time: clock(raw.time),
        party_size: Number.isFinite(size) && size > 0 ? size : null,
        platform: str(raw.platform),
        confirmation: str(raw.confirmation),
        seating: str(raw.seating),
        city: str(raw.city),
        address: str(raw.address),
        phone: str(raw.phone),
        notes: str(raw.notes),
    };
};

/** A hotel stay, or null. Needs a name and a check-out after the check-in. */
export const cleanStay = (raw = {}) => {
    const name = str(raw.name);
    const checkIn = day(raw.check_in);
    const checkOut = day(raw.check_out);
    if (!name || !checkIn || !checkOut || checkOut <= checkIn) return null;
    const cost = money(raw.cost);
    return {
        name,
        address: str(raw.address),
        city: str(raw.city),
        check_in: checkIn,
        check_out: checkOut,
        cost,
        currency: cost ? (str(raw.currency)?.toUpperCase().slice(0, 3) || null) : null,
        confirmation: str(raw.confirmation),
        link: web(raw.link),
        notes: str(raw.notes),
    };
};

/** When an item happens, for sorting the review list. */
const whenOf = (item) => {
    if (item.type === 'journey') return `${item.depart_date}T${item.depart_time || ''}`;
    if (item.type === 'stay') return `${item.check_in}T15:00`;
    return `${item.date}T${item.time || ''}`;
};

/**
 * The model's four lists, cleaned and flattened into one list of typed items
 * in date order, plus how many looked like bookings but could not be read.
 */
export const cleanAll = (input = {}) => {
    const items = [];
    let dropped = 0;

    const named = (raw) => ['name', 'restaurant', 'venue'].some((k) => str(raw?.[k]));

    const seenTable = new Set();
    for (const raw of Array.isArray(input.tables) ? input.tables : []) {
        const t = cleanTable(raw);
        if (!t) { if (named(raw)) dropped += 1; continue; }
        const key = `${t.date}|${t.time}|${t.name}`.toLowerCase();
        if (seenTable.has(key)) continue;
        seenTable.add(key);
        items.push({ type: 'table', ...t });
    }

    const legs = cleanLegs(input.journeys);
    dropped += legs.dropped;
    for (const leg of legs.legs) items.push({ type: 'journey', ...leg });

    const gigs = cleanGigs(input.gigs);
    dropped += gigs.dropped;
    for (const g of gigs.gigs) items.push({ type: 'gig', ...g });

    const seenStay = new Set();
    for (const raw of Array.isArray(input.stays) ? input.stays : []) {
        const s = cleanStay(raw);
        if (!s) { if (named(raw)) dropped += 1; continue; }
        const key = `${s.check_in}|${s.check_out}|${s.name}`.toLowerCase();
        if (seenStay.has(key)) continue;
        seenStay.add(key);
        items.push({ type: 'stay', ...s });
    }

    items.sort((a, b) => whenOf(a).localeCompare(whenOf(b)));
    return { items: items.slice(0, 20), dropped };
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
                max_tokens: 4096,
                system: SYSTEM,
                tools: [SCHEMA],
                tool_choice: { type: 'tool', name: 'bookings' },
                messages: [{
                    role: 'user',
                    content: `Today is ${new Date().toISOString().slice(0, 10)}.\n\n${text}`,
                }],
            }),
            signal: AbortSignal.timeout(35000),
        });

        if (!r.ok) {
            console.error('booking-parse: Anthropic', r.status, (await r.text()).slice(0, 300));
            return res.status(502).json({ error: 'Could not read that one.' });
        }

        const reply = await r.json();
        const call = (reply.content || []).find((c) => c.type === 'tool_use');
        const { items, dropped } = cleanAll(call?.input || {});

        if (!items.length) {
            return res.status(200).json({
                ok: false,
                error: dropped
                    ? 'It found a booking in there but no date it could read. Add this one by hand.'
                    : 'That does not look like a booking confirmation.',
            });
        }
        return res.status(200).json({ ok: true, items, dropped });
    } catch (err) {
        console.error('booking-parse threw', err?.name, err?.message);
        return res.status(502).json({ error: 'Could not read that one.' });
    }
}
