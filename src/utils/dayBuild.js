/**
 * Speaking the editor's language to the Atlas's tables.
 *
 * The Daydream's editor was built against `plan_items` and every helper in
 * the portal — the comparator, the leave-by arithmetic, the duration picker,
 * the share sheet — speaks that vocabulary: `activity`, `duration`,
 * `is_brainstorm`. The Atlas stores the same day as `atlas_day_items`:
 * `title`, `end_time`, and a separate ideas table.
 *
 * Rather than rewrite every helper to speak two dialects, the rows are
 * translated at the edge. What the editor holds in memory is a *stop* in the
 * old vocabulary; what goes to the database is an Atlas row. The translation
 * is small, pure, and the only place the two spellings meet.
 *
 * The one real difference is length. `plan_items` stored a duration; the
 * Atlas stores when the thing ends. Those are the same fact told two ways,
 * and an end time is the better of the two — it survives the start moving.
 */

import { minutesOf } from './planToAtlas.js';
import { asMinutes, asTime } from './dayOrder.js';

const DAY = 1440;

/**
 * When something ends, given when it starts and how long it takes.
 *
 * A dinner at eleven that runs two hours ends at one in the morning, which is
 * a real thing to plan and not an error, so it wraps rather than clamping to
 * 23:59.
 */
export const endFrom = (start, duration) => {
    const from = asMinutes(start);
    const long = minutesOf(duration);
    if (from === null || !long) return null;
    return asTime((from + long) % DAY);
};

/**
 * How long something takes, given when it starts and ends.
 *
 * Written as "H:MM", which is what the duration picker writes and the one
 * form nothing has ever had to guess at.
 */
export const durationFrom = (start, end) => {
    const from = asMinutes(start);
    const to = asMinutes(end);
    if (from === null || to === null) return null;

    // Ends before it starts means it ran past midnight.
    const mins = to >= from ? to - from : to + DAY - from;
    if (!mins) return null;
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
};

/**
 * A price as she typed it.
 *
 * Postgres hands back `numeric` as "100.00". Putting that in the box means
 * every card that has ever had a price shows two decimal places she did not
 * type, and blurring the field then reads as a change and saves it back.
 */
export const showCost = (cost) => {
    if (cost === null || cost === undefined || cost === '') return '';
    const n = Number(cost);
    if (!Number.isFinite(n)) return String(cost);
    return String(n % 1 === 0 ? Math.trunc(n) : n);
};

/** And back again. Anything that is not a number is no price at all. */
export const readCost = (cost) => {
    if (cost === null || cost === undefined) return null;
    const text = String(cost).trim();
    if (!text) return null;
    const n = Number(text.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
};

/** An `atlas_day_items` row, as the editor wants to hold it. */
export const toStop = (row) => ({
    id: row.id,
    activity: row.title || '',
    start_time: row.start_time || null,
    duration: durationFrom(row.start_time, row.end_time),
    location: row.location || '',
    link: row.link || '',
    notes: row.notes || '',
    cost: showCost(row.cost),
    cost_shared: row.cost_shared,
    icon: row.icon || null,
    travel_note: row.travel_note || null,
    place_id: row.place_id || null,
    place_data: row.place_data || null,
    spot_id: row.spot_id || null,
    booked_id: row.booked_id || null,
    /* Three states, not two: nothing to book, still to book, booked. The
       boolean this replaces could not tell a walk in the park from a
       restaurant she has not rung yet. */
    booking: row.booked_id ? 'booked' : (row.booking || (row.booked ? 'booked' : 'none')),
    booked: Boolean(row.booked || row.booked_id),
    kind: row.kind || 'other',
    colour: row.colour ?? null,
    sort_order: row.sort_order ?? 0,
    // The board is a different table now, so nothing on the day is an idea.
    is_brainstorm: false,
});

/** And back, ready to be written. */
export const toRow = (stop, { dayId, userId, order } = {}) => ({
    day_id: dayId,
    user_id: userId,
    // The column is NOT NULL and an unnamed card is a real thing to have on
    // screen while you think, so it is given the most honest possible name
    // rather than being refused.
    title: (stop.activity || '').trim() || 'Something',
    start_time: stop.start_time || null,
    end_time: endFrom(stop.start_time, stop.duration),
    location: (stop.location || '').trim() || null,
    link: (stop.link || '').trim() || null,
    notes: (stop.notes || '').trim() || null,
    cost: readCost(stop.cost),
    cost_shared: stop.cost_shared !== false,
    icon: stop.icon || null,
    travel_note: stop.travel_note || null,
    place_id: stop.place_id || null,
    place_data: stop.place_data || null,
    spot_id: stop.spot_id || null,
    booked_id: stop.booked_id || null,
    booking: stop.booked_id ? 'booked' : (stop.booking || 'none'),
    booked: Boolean(stop.booked || stop.booked_id || stop.booking === 'booked'),
    kind: stop.kind || 'other',
    colour: stop.colour ?? null,
    sort_order: order ?? stop.sort_order ?? 0,
});

/** An `atlas_ideas` row, as the board wants to hold it. */
export const toIdea = (row) => ({
    id: row.id,
    activity: row.title || '',
    start_time: row.start_time || null,
    duration: null,
    location: row.area || '',
    link: row.url || '',
    notes: row.notes || '',
    cost: showCost(row.cost),
    cost_shared: true,
    icon: row.icon || null,
    place_id: row.place_id || null,
    place_data: row.place_data || null,
    kind: row.kind || 'do',
    trip_id: row.trip_id ?? null,
    sort_order: row.sort_order ?? 0,
    // Everything on the board is an idea, which is what the comparator and
    // the share sheet already know how to read.
    is_brainstorm: true,
});

/** And back. */
export const ideaRow = (stop, { tripId, userId, order } = {}) => ({
    trip_id: tripId ?? null,
    user_id: userId,
    kind: stop.kind && stop.kind !== 'other' ? stop.kind : 'do',
    title: (stop.activity || '').trim() || 'Something',
    notes: (stop.notes || '').trim() || null,
    url: (stop.link || '').trim() || null,
    cost: readCost(stop.cost),
    area: (stop.location || '').trim() || null,
    start_time: stop.start_time || null,
    // The emoji and the place travel with the idea, so promoting it later
    // gives back the card she had rather than a bare title.
    icon: stop.icon || null,
    place_id: stop.place_id || null,
    place_data: stop.place_data || null,
    sort_order: order ?? stop.sort_order ?? 0,
});

/**
 * Which ideas belong on this trip's board.
 *
 * A place captured before it belonged anywhere has no trip, and showing it on
 * every board is the entire point of letting `trip_id` be null — it is the
 * pile of things you might do, and a day being planned is exactly when you
 * want to see it.
 */
export const boardFor = (ideas, tripId) => (ideas || []).filter(
    (i) => i.trip_id === null || i.trip_id === undefined || String(i.trip_id) === String(tripId)
);

/** Is this stop one the Atlas made, or one an idea became? */
export const isLoose = (stop) => Boolean(stop?.is_brainstorm);
