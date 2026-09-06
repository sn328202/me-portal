/**
 * The Ticket Book — how she gets there.
 *
 * The Table Book already holds a `transport` kind, and for a train it was
 * almost enough: a name, a time, a confirmation. Almost, because a journey is
 * the one booking with *two* of everything. Two places, two clocks, and a
 * number that means something to a departure board. Writing "Eurostar 9024 to
 * Paris" into a field called `name` and the arrival time into `notes` is how
 * you end up with a booking you cannot sort, cannot total, and cannot put on
 * a day without reading it first.
 *
 * So this is its own shape, and everything here is pure — the interesting
 * parts are the arithmetic across midnight and across time zones, which is
 * exactly the sort that looks right in the afternoon and is a day out at 11pm.
 */

export const MODES = [
    { id: 'flight', label: 'Flight', face: '✈️', verb: 'Fly' },
    { id: 'train', label: 'Train', face: '🚆', verb: 'Take' },
    { id: 'bus', label: 'Bus', face: '🚌', verb: 'Take' },
    { id: 'ferry', label: 'Ferry', face: '⛴️', verb: 'Sail' },
    { id: 'car', label: 'Car', face: '🚗', verb: 'Drive' },
    { id: 'other', label: 'Other', face: '🎫', verb: 'Travel' },
];

const BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m]));

/** The mode of a journey, defaulting to the one most of them are. */
export const modeOf = (journey) => {
    const id = String(journey?.mode || '').trim();
    return BY_ID[id] ? id : 'flight';
};

export const faceOf = (journey) => BY_ID[modeOf(journey)].face;
export const labelOf = (journey) => BY_ID[modeOf(journey)].label;

/**
 * A guess from what she called it, or from a pasted confirmation.
 *
 * Order matters. "Ferry" appears in plenty of flight confirmations as a
 * transfer option and "car" appears in "car hire", so the more specific
 * carriers are tested before the bare words. Unlike `guessKind` the fallback
 * here is a flight rather than "other": everything in this book is transport
 * already, and by volume a booked journey with an unreadable name is a plane.
 */
const HINTS = [
    [/\b(eurostar|amtrak|caltrain|sncf|trenitalia|renfe|deutsche bahn|db bahn|via rail|shinkansen|railcard|rail|platform|coach [a-z]?\d)\b|\btrain\b/i, 'train'],
    [/\b(flight|airlines?|airways|aeroplane|airplane|boarding pass|gate \w|terminal \d|baggage allowance|pnr)\b/i, 'flight'],
    [/\b(ferry|sailing|catamaran|hydrofoil|cabin deck|vessel)\b/i, 'ferry'],
    [/\b(coach|bus|flixbus|greyhound|megabus|national express)\b/i, 'bus'],
    [/\b(car hire|rental car|hire car|pick[- ]?up location|drop[- ]?off|driver|transfer)\b/i, 'car'],
];

export const guessMode = (text) => {
    const said = String(text || '');
    for (const [pattern, mode] of HINTS) if (pattern.test(said)) return mode;
    return 'flight';
};

const two = (n) => String(n).padStart(2, '0');

/* `new Date(null)` is the epoch, not an invalid date, so an absent value has
   to be turned away before it becomes 1 Jan 1970 at midnight. */
const when = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * The date a timestamp falls on, *where the reader is*.
 *
 * The same trap `reservationToDay` documents: `toISOString().slice(0,10)` gives
 * the date in UTC, and a 9pm departure from San Francisco is the next day in
 * UTC. Every reading below is local.
 */
export const localDate = (value) => {
    const d = when(value);
    if (!d) return null;
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

/** The time it happens, on a 24-hour clock, with the seconds Postgres wants. */
export const localTime = (value) => {
    const d = when(value);
    if (!d) return null;
    return `${two(d.getHours())}:${two(d.getMinutes())}:00`;
};

/** Does it land on a later date than it left? */
export const crossesMidnight = (journey) => {
    const from = localDate(journey?.depart_at);
    const to = localDate(journey?.arrive_at);
    return Boolean(from && to && to > from);
};

/**
 * How long it takes, in minutes.
 *
 * Straight subtraction of two `timestamptz` values, which is the whole reason
 * both ends are stored as instants rather than as wall clocks: a flight from
 * Tokyo landing in Los Angeles "before it left" is nine hours, not minus
 * eight, and only an absolute instant knows that.
 */
export const minutesOf = (journey) => {
    const from = when(journey?.depart_at);
    const to = when(journey?.arrive_at);
    if (!from || !to) return null;
    const mins = Math.round((to - from) / 60000);
    return mins >= 0 ? mins : null;
};

/** "7h 20m", "45m", or null when there is no arrival to measure to. */
export const durationLabel = (journey) => {
    const mins = minutesOf(journey);
    if (mins === null) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (!h) return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
};

/** "LHR → BOM", or whichever end is known, or null when neither is. */
export const routeLabel = (journey) => {
    const from = String(journey?.from_place || '').trim();
    const to = String(journey?.to_place || '').trim();
    if (from && to) return `${from} → ${to}`;
    if (to) return `→ ${to}`;
    if (from) return `${from} →`;
    return null;
};

/** "BA 286" — the thing you type into a departure board. */
export const serviceLabel = (journey) => [
    String(journey?.carrier || '').trim() || null,
    String(journey?.number || '').trim() || null,
].filter(Boolean).join(' ') || null;

/**
 * What a journey is called when something else has to name it.
 *
 * A journey has no `name` column on purpose — its identity is its route, and a
 * field she has to fill in with "flight to Bombay" when she has already said
 * LHR and BOM is a field that will disagree with them by next Tuesday.
 */
export const titleOf = (journey) => {
    const route = routeLabel(journey);
    const service = serviceLabel(journey);
    if (route && service) return `${route} · ${service}`;
    return route || service || `${labelOf(journey)} booking`;
};

/**
 * The line under the name: what you would want to read in a taxi.
 *
 * The confirmation earns its place — it is the one thing that cannot be
 * worked out again from anywhere else — and so does the arrival, because a
 * journey you know the end of is a journey you can plan the evening around.
 *
 * The carrier and number are deliberately *not* here. Everywhere this note is
 * drawn, `titleOf` is drawn directly above it, and the title already ends in
 * them — so including them read "SFO → BOM · Air India AI 174 · Air India AI
 * 174 · 8h 35m", which is the sort of thing you stop seeing after a week and
 * a stranger notices in a second.
 */
export const journeyNote = (j) => {
    const bits = [];
    const dur = durationLabel(j);
    if (dur) bits.push(dur);
    if (crossesMidnight(j)) bits.push('Arrives next day');
    if (j?.confirmation) bits.push(`Confirmation ${j.confirmation}`);
    if (j?.baggage) bits.push(j.baggage);
    if (j?.notes) bits.push(j.notes);
    return bits.join(' · ');
};

/**
 * How long to draw it when there is nothing to measure.
 *
 * Only used for a journey with no arrival time. Ninety minutes is not a guess
 * at the journey — it is a guess at how much of her day it will eat, which is
 * the question the timeline is actually asking.
 */
export const DEFAULT_LEG = 90;

/** A time plus some minutes, as a time. Midnight is 00:00, never 24:00. */
export const plus = (time, minutes) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
    if (!m) return null;
    const total = Number(m[1]) * 60 + Number(m[2]) + minutes;
    const wrapped = ((total % 1440) + 1440) % 1440;
    return `${two(Math.floor(wrapped / 60))}:${two(wrapped % 60)}:00`;
};

/**
 * A journey as a row of `atlas_day_items`, on the day it departs.
 *
 * One block, running departure to arrival — which means an overnight flight
 * ends at an earlier clock time than it starts. That is not a bug being
 * tolerated: the timeline draws a day, and 23:40 → 06:15 is exactly what a
 * red-eye does to one. The note says "Arrives next day" so the card admits it
 * in words as well.
 */
export const asAtlasItem = (j) => {
    const start = localTime(j?.depart_at);
    const sameDay = !crossesMidnight(j);
    return {
        title: titleOf(j),
        kind: 'transport',
        // It came from the Ticket Book, so it is booked — that is the whole
        // claim a ticket makes. And it points at the journey rather than
        // copying it, so changing the booking changes what the day shows.
        booking: 'booked',
        journey_id: j?.id || null,
        start_time: start,
        /* An arrival on a later date cannot be an end time on this day's
           clock, so it is left off rather than drawn wrong: an item ending
           before it starts is a negative-height block on the timeline. */
        end_time: sameDay ? (localTime(j?.arrive_at) || plus(start, DEFAULT_LEG)) : null,
        location: routeLabel(j),
        link: null,
        notes: journeyNote(j) || null,
        cost: j?.cost === null || j?.cost === undefined || j?.cost === '' ? null : Number(j.cost),
    };
};

/**
 * Held and gone, split on the clock rather than on status.
 *
 * A journey in the past that was never ticked off is still 'booked' in the
 * database and is history to a reader — the same reasoning `useReservations`
 * uses, and the same reason it lives in a pure function: "is this trip still
 * ahead of me" is worth being able to test without a database.
 */
export const splitByClock = (journeys = [], now = Date.now()) => {
    const live = journeys.filter((j) => j.status === 'booked');
    return {
        upcoming: live
            .filter((j) => when(j.depart_at) && when(j.depart_at).getTime() >= now)
            .sort((a, b) => when(a.depart_at) - when(b.depart_at)),
        past: journeys
            .filter((j) => j.status !== 'booked'
                || !when(j.depart_at)
                || when(j.depart_at).getTime() < now)
            .sort((a, b) => when(b.depart_at) - when(a.depart_at)),
    };
};

/** What the journeys cost, for the ones that say. */
export const totalCost = (journeys = []) => journeys
    .reduce((sum, j) => sum + (Number(j?.cost) || 0), 0);

/**
 * What they cost, kept in the currencies they were paid in.
 *
 * One number is a lie the moment a Eurostar ticket in pounds is added to a
 * flight in dollars — and it is a quiet lie, because £96 + $1,606.20 =
 * "$1,702.20" looks like a total rather than like nonsense. No rates are
 * fetched and none should be: the honest answer is both figures.
 *
 * Biggest first, so the one that dominates the trip leads.
 */
export const totalsByCurrency = (journeys = [], fallback = 'USD') => {
    const buckets = new Map();
    for (const j of journeys) {
        const amount = Number(j?.cost);
        if (!Number.isFinite(amount) || !amount) continue;
        const code = String(j?.currency || fallback).toUpperCase();
        buckets.set(code, (buckets.get(code) || 0) + amount);
    }
    return [...buckets.entries()]
        .map(([currency, total]) => ({ currency, total }))
        .sort((a, b) => b.total - a.total);
};
