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

/**
 * A ticket's two times, read exactly as printed.
 *
 * This is the whole model, and it is worth saying plainly: **a journey's two
 * times are wall clocks at two different places, and neither is an instant.**
 *
 * A flight leaving San Francisco at 9am and landing in New York at 6pm was six
 * hours in the air and moved three forward. Stored as instants, the pair can
 * tell you it took six hours and can no longer tell you the arrivals board
 * says six o'clock — the local clock is gone the moment you normalise, and the
 * zone was never asked for. But six o'clock is the fact she plans around: it
 * is what time it will be where she is standing when she gets off.
 *
 * So both ends are strings, and every reading below is a substring. No `Date`
 * is constructed for anything shown on screen, because constructing one
 * re-applies whichever zone the browser happens to be in and quietly undoes
 * the point of all of this.
 */
const parts = (value) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value || ''));
    if (!m) return null;
    return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
};

/** The date printed on that end of the ticket. */
export const localDate = (value) => parts(value)?.date || null;

/** The time printed on it, with the seconds Postgres wants. */
export const localTime = (value) => {
    const p = parts(value);
    return p ? `${p.time}:00` : null;
};

/** "6:15 PM" — the clock at whichever end this is, for reading. */
export const clockLabel = (value) => {
    const p = parts(value);
    if (!p) return null;
    const [h, m] = p.time.split(':').map(Number);
    const suffix = h < 12 ? 'AM' : 'PM';
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return `${twelve}:${two(m)} ${suffix}`;
};

/**
 * Does the ticket say she lands on a later date than she left?
 *
 * The dates as *written*, not as computed. A red-eye leaving on the 16th and
 * landing on the 17th says so on the ticket, and that is the only place the
 * answer can honestly come from now.
 */
export const crossesMidnight = (journey) => {
    const from = localDate(journey?.departs);
    const to = localDate(journey?.arrives);
    return Boolean(from && to && to > from);
};

/**
 * Can this be drawn as one block on the day it leaves?
 *
 * Only when the ticket lands on the same date at a later clock time. Two cases
 * say no, and both would otherwise draw a block that ends before it starts:
 *
 *   - a red-eye, landing on tomorrow's date;
 *   - and the strange one — Tokyo 5pm to Los Angeles 10am *the same calendar
 *     day*, which is a real eleven-hour flight backwards across the date line.
 */
export const drawsAsBlock = (journey) => {
    const from = parts(journey?.departs);
    const to = parts(journey?.arrives);
    return Boolean(from && to && to.date === from.date && to.time > from.time);
};

/**
 * How much of the day it eats, by the clocks at each end.
 *
 * Deliberately *not* called a duration, and deliberately not shown as one.
 * San Francisco 9am to New York 6pm is nine hours of her day and a six-hour
 * flight, and printing "9h" beside a flight number is printing something the
 * ticket contradicts.
 *
 * What it is good for is the block: nine hours is exactly how much of the
 * timeline the journey should occupy, because she is unavailable from nine
 * until she lands and it is six o'clock when she does.
 */
export const clockMinutes = (journey) => {
    const from = parts(journey?.departs);
    const to = parts(journey?.arrives);
    if (!from || !to) return null;

    const mins = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    const days = Math.round(
        (Date.parse(`${to.date}T00:00:00Z`) - Date.parse(`${from.date}T00:00:00Z`)) / 86400000
    );
    if (!Number.isFinite(days)) return null;

    const span = days * 1440 + mins(to.time) - mins(from.time);
    return span >= 0 ? span : null;
};

/** "9h 20m", "45m", or null. Always labelled as clock time where it is shown. */
export const clockSpanLabel = (journey) => {
    const mins = clockMinutes(journey);
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
 * The arrival leads, because it is the fact the rest of the day hangs off —
 * what time it will be where she is standing when she gets off. Then the
 * confirmation, which is the one thing that cannot be worked out again from
 * anywhere else.
 *
 * The carrier and number are deliberately absent: everywhere this note is
 * drawn, `titleOf` is drawn directly above it and already ends in them.
 *
 * And `duration` is whatever the ticket said, never a subtraction. Two wall
 * clocks in two zones cannot be subtracted into a flying time, and a number
 * that contradicts the boarding pass is worse than no number.
 */
export const journeyNote = (j) => {
    const bits = [];
    const lands = clockLabel(j?.arrives);
    if (lands) bits.push(`Lands ${lands}${crossesMidnight(j) ? ' next day' : ''} local`);
    if (j?.duration) bits.push(String(j.duration).trim());
    if (j?.confirmation) bits.push(`Confirmation ${j.confirmation}`);
    if (j?.baggage) bits.push(j.baggage);
    if (j?.notes) bits.push(j.notes);
    return bits.join(' · ');
};

/**
 * How long to draw it when the ticket does not say where it ends.
 *
 * Only used for a journey with no arrival time at all. Ninety minutes is not a
 * guess at the journey — it is a guess at how much of her day it will eat,
 * which is the question the timeline is actually asking.
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
 * One block, running from the clock she leaves on to the clock she lands on —
 * her own words for why: *"if a flight leaves 9 am sf and arrives 6pm nyc time
 * … on the timeline it should show as a block from 9 am to 6pm since i land
 * 6pm time nyc and that helps me to plan around the timezone that i land
 * in."*
 *
 * Which means the block is nine hours long for a six-hour flight, on purpose.
 * It is not measuring the flight. It is measuring how much of her day is gone,
 * and it ends where the evening starts.
 */
export const asAtlasItem = (j) => {
    const start = localTime(j?.departs);
    return {
        title: titleOf(j),
        kind: 'transport',
        // It came from the Ticket Book, so it is booked — that is the whole
        // claim a ticket makes. And it points at the journey rather than
        // copying it, so changing the booking changes what the day shows.
        booking: 'booked',
        journey_id: j?.id || null,
        start_time: start,
        /* Only when the ticket lands the same day at a later clock. A red-eye
           landing tomorrow, and the rarer Tokyo-to-Los-Angeles case that lands
           at an earlier clock on the same date, would both draw a block that
           ends before it starts — a negative-height row on the timeline. Those
           get no end time, and the note says where they land in words. */
        end_time: drawsAsBlock(j)
            ? localTime(j?.arrives)
            : (localTime(j?.arrives) ? null : plus(start, DEFAULT_LEG)),
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
 * database and is history to a reader.
 *
 * This is the one place a `Date` is built from a departure, and the only place
 * it is defensible: "is this still ahead of me" tolerates being a few hours
 * out, which is the most a missing zone can cost. Nothing displayed goes
 * through here.
 */
const roughly = (value) => {
    const p = parts(value);
    if (!p) return null;
    const t = Date.parse(`${p.date}T${p.time}:00Z`);
    return Number.isNaN(t) ? null : t;
};

export const splitByClock = (journeys = [], now = Date.now()) => {
    const live = journeys.filter((j) => j.status === 'booked');
    const at = (j) => roughly(j.departs);
    return {
        upcoming: live
            .filter((j) => at(j) !== null && at(j) >= now)
            .sort((a, b) => at(a) - at(b)),
        past: journeys
            .filter((j) => j.status !== 'booked' || at(j) === null || at(j) < now)
            .sort((a, b) => at(b) - at(a)),
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

/**
 * The add-a-journey form, empty.
 *
 * Lives here rather than in the page so the two things that fill it — a person
 * typing, and a pasted confirmation — can be tested against the same shape.
 * The form is two boxes per end (a date and a clock) because that is how a
 * ticket is printed and how a browser's date and time inputs work; `stamp`
 * puts them back together.
 */
export const BLANK_FORM = {
    mode: 'flight', carrier: '', number: '',
    from_place: '', to_place: '',
    date: '', time: '09:00', arrive_date: '', arrive_time: '',
    confirmation: '', duration: '', cost: '', currency: 'USD', baggage: '', notes: '',
};

/** Two boxes back into one wall clock. No `Date`, no zone, no `Z`. */
export const stamp = (day, time) => (day && time ? `${day}T${String(time).slice(0, 5)}:00` : null);

/**
 * A parsed leg as the form holds it.
 *
 * The arrival date is only carried across when it differs from the departure
 * date: leaving the second date box blank is what "same day" looks like in the
 * form, and pre-filling it with the same date makes every ordinary flight look
 * like it needed the red-eye field.
 */
export const formFromLeg = (leg = {}) => ({
    ...BLANK_FORM,
    mode: leg.mode || 'flight',
    carrier: leg.carrier || '',
    number: leg.number || '',
    from_place: leg.from_place || '',
    to_place: leg.to_place || '',
    date: leg.depart_date || '',
    time: leg.depart_time || '09:00',
    arrive_date: leg.arrive_date && leg.arrive_date !== leg.depart_date ? leg.arrive_date : '',
    arrive_time: leg.arrive_time || '',
    confirmation: leg.confirmation || '',
    duration: leg.duration || '',
    cost: leg.cost === null || leg.cost === undefined ? '' : String(leg.cost),
    currency: leg.currency || 'USD',
    baggage: leg.baggage || '',
    notes: leg.notes || '',
});

/**
 * The form as a row for the database.
 *
 * The one place the form's two-box ends become the two stored wall clocks, so
 * there is exactly one answer to "what gets written" whether she typed it or
 * pasted it.
 */
export const journeyFromForm = (form = {}) => ({
    mode: form.mode || 'flight',
    carrier: String(form.carrier || '').trim() || null,
    number: String(form.number || '').trim() || null,
    from_place: String(form.from_place || '').trim() || null,
    to_place: String(form.to_place || '').trim() || null,
    departs: stamp(form.date, form.time || '09:00'),
    /* An arrival with no date of its own is the same day it left. */
    arrives: stamp(form.arrive_date || form.date, form.arrive_time),
    confirmation: String(form.confirmation || '').trim() || null,
    duration: String(form.duration || '').trim() || null,
    /* An empty cost box is "she did not say", not zero. A free flight and an
       unrecorded one are different facts. */
    cost: form.cost === '' || form.cost === null || form.cost === undefined
        ? null : Number(form.cost),
    currency: form.cost ? (form.currency || null) : null,
    baggage: String(form.baggage || '').trim() || null,
    notes: String(form.notes || '').trim() || null,
});

/**
 * One line describing a parsed leg, for the list she ticks before saving.
 *
 * Everything load-bearing in one glance: which day, both clocks, the route and
 * the service. If a line here is wrong she unticks it — which is the entire
 * reason the parser does not save anything itself.
 */
export const legSummary = (leg = {}) => {
    const shaped = {
        ...leg,
        departs: stamp(leg.depart_date, leg.depart_time),
        arrives: stamp(leg.arrive_date, leg.arrive_time),
    };
    const bits = [routeLabel(shaped) || 'Somewhere', clockLabel(shaped.departs)];
    const lands = clockLabel(shaped.arrives);
    if (lands) {
        bits.push(`→ ${lands}${crossesMidnight(shaped) ? ' next day' : ''}`);
    }
    const service = serviceLabel(shaped);
    if (service) bits.push(service);
    return bits.filter(Boolean).join(' · ');
};
