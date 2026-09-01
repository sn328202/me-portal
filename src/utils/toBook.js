/**
 * Everything still to ring up, wherever it lives, in the order it happens.
 *
 * A day says what is still to book on that day, and a trip says it for that
 * trip — but the question she actually asks is "what have I not booked
 * *yet*", and that spans every trip and every loose day at once. Answering it
 * meant opening each of them in turn and remembering.
 *
 * Date order, because that is the order the phone calls have to happen in.
 */

import { todayLocal } from './today.js';

const day = (value) => {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

/** Whole days between two dates, negative for the past. */
export const daysBetween = (from, to) => {
    const a = day(from);
    const b = day(to);
    if (!a || !b) return null;
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
};

/**
 * How soon, in words.
 *
 * A date on its own makes you do the arithmetic every time you glance at the
 * list, which is the opposite of what a list like this is for.
 */
export const whenLabel = (date, today = todayLocal()) => {
    const away = daysBetween(today, date);
    if (away === null) return 'No date';
    if (away === 0) return 'Today';
    if (away === 1) return 'Tomorrow';
    if (away === -1) return 'Was yesterday';
    if (away < 0) return `Was ${Math.abs(away)} days ago`;
    return `In ${away} days`;
};

/**
 * How much it matters that this is still not booked.
 *
 * Something in two days is a different feeling from something in two months,
 * and something that has already been is not urgent at all — it is a loose
 * end, and pretending otherwise makes the urgent things harder to see.
 */
export const urgency = (date, today = todayLocal()) => {
    const away = daysBetween(today, date);
    if (away === null) return 'undated';
    if (away < 0) return 'gone';
    if (away <= 2) return 'now';
    if (away <= 14) return 'soon';
    return 'later';
};

/**
 * The list, flattened and sorted.
 *
 * Rows come back from Postgres nested — an item inside a day inside a trip —
 * because that is how they are stored, not how they are read.
 */
export const toBookList = (rows, today = todayLocal()) => (rows || [])
    .map((row) => {
        const d = row.atlas_days || row.day || {};
        const trip = d.atlas_trips || d.trip || {};
        const date = day(d.date);
        return {
            id: row.id,
            title: String(row.title || '').trim() || 'Something',
            at: row.start_time ? String(row.start_time).slice(0, 5) : null,
            date,
            city: d.city || null,
            tripId: d.trip_id ?? trip.id ?? null,
            trip: trip.destination || null,
            when: whenLabel(date, today),
            urgency: urgency(date, today),
            days: daysBetween(today, date),
        };
    })
    .sort((a, b) => {
        // Undated things have no place in a queue of phone calls, so they go
        // last rather than first — which is where an empty string sorts.
        if (!a.date && !b.date) return String(a.title).localeCompare(b.title);
        if (!a.date) return 1;
        if (!b.date) return -1;
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        if (a.at && b.at && a.at !== b.at) return a.at < b.at ? -1 : 1;
        if (a.at && !b.at) return -1;
        if (!a.at && b.at) return 1;
        return String(a.title).localeCompare(b.title);
    });

/** How many of them are already overdue. */
export const overdue = (list) => (list || []).filter((i) => i.urgency === 'gone').length;

/** A line for the top of the card. */
export const describeToBook = (list) => {
    const n = (list || []).length;
    if (!n) return 'Nothing waiting on a phone call.';
    const late = overdue(list);
    const head = `${n} still to book`;
    return late ? `${head} · ${late} already been` : head;
};
