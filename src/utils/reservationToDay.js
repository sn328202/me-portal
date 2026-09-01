/**
 * A booked table, put on a day — either a Daydream itinerary or a trip in the
 * Atlas.
 *
 * A reservation already knows everything a plan needs: where, when, how many,
 * and the confirmation code you will want on your phone at the door. Typing it
 * again into the day it belongs to is the same duplication as typing an
 * itinerary into a trip, and has the same answer: it knows which day, because
 * it knows when it is.
 *
 * The trap here is the timezone. `starts_at` is a `timestamptz`, and the
 * obvious way to get a date out of it — `toISOString().slice(0, 10)` — gives
 * the date in *UTC*. A table at 8:45pm in San Francisco is 03:45 the next day
 * in UTC, so a booking on Sunday would go looking for a Monday, find one, and
 * quietly land a day late. Every reading below is local.
 */

const two = (n) => String(n).padStart(2, '0');

/* How long a table is, unless told otherwise. Nobody books a restaurant for
   half an hour, and a dinner that claims to end when it starts makes a mess of
   every timeline it lands on. Two hours is the honest default and she can
   change it on the card. */
export const DEFAULT_TABLE = 120;

/* `new Date(null)` is the epoch, not an invalid date, so an absent value has
   to be turned away before it becomes 1 Jan 1970 at midnight. */
const when = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** The date the booking is on, where the booking is. */
export const localDate = (starts_at) => {
    const d = when(starts_at);
    if (!d) return null;
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

/** The time it starts, on a 24-hour clock, with seconds Postgres will take. */
export const localTime = (starts_at) => {
    const d = when(starts_at);
    if (!d) return null;
    return `${two(d.getHours())}:${two(d.getMinutes())}:00`;
};

/**
 * The line under the name: what you would want to read standing outside.
 *
 * The confirmation code earns its place — it is the one thing you cannot work
 * out again from anywhere else — and so does the party size, because a table
 * for two and a table for eight are different evenings.
 */
export const bookingNote = (r) => [
    r?.party_size ? `Party of ${r.party_size}` : null,
    r?.seating || null,
    r?.platform ? `Booked via ${r.platform}` : null,
    r?.confirmation ? `Confirmation ${r.confirmation}` : null,
    r?.phone || null,
    r?.notes || null,
].filter(Boolean).join(' · ');

/** A time plus some minutes, as a time. Midnight is 00:00, never 24:00. */
export const plus = (time, minutes) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
    if (!m) return null;
    const total = Number(m[1]) * 60 + Number(m[2]) + minutes;
    const wrapped = ((total % 1440) + 1440) % 1440;
    return `${two(Math.floor(wrapped / 60))}:${two(wrapped % 60)}:00`;
};

/** A reservation as a row of `atlas_day_items`. */
export const asAtlasItem = (r) => ({
    title: String(r?.name || r?.restaurant || '').trim() || 'Reservation',
    // A booked table is food, and belongs in the trip's food total.
    kind: 'food',
    /* It came from the Table Book, so it is booked — that is the whole
       claim a reservation makes. And it points at the booking rather than
       copying it, so changing the booking changes what the day shows. */
    booked: true,
    booked_id: r?.id || null,
    start_time: localTime(r?.starts_at),
    end_time: plus(localTime(r?.starts_at), DEFAULT_TABLE),
    location: r?.address || r?.city || null,
    // The whole reason for resolving the restaurant against Google: the card
    // this becomes should open the map, not just say a name.
    link: r?.maps_url || r?.website || null,
    notes: bookingNote(r) || null,
    cost: null,
});

/** A reservation as a row of `plan_items`. */
export const asPlanItem = (r) => ({
    activity: String(r?.name || r?.restaurant || '').trim() || 'Reservation',
    start_time: localTime(r?.starts_at),
    duration: '2 hours',
    location: r?.address || r?.city || null,
    link: r?.maps_url || r?.website || null,
    notes: bookingNote(r) || null,
    cost: null,
    is_brainstorm: false,
});

/** The day of a trip, or the itinerary, that this booking falls on. */
export const dayOn = (starts_at, days = [], field = 'date') => {
    const want = localDate(starts_at);
    if (!want) return null;
    return days.find((d) => String(d[field] || '').slice(0, 10) === want) || null;
};
