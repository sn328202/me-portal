/**
 * The order of a day, and where a dragged card lands in it.
 *
 * Three bugs lived here, and all three read to a user as "the itinerary is
 * flaky" rather than as anything specific.
 *
 * 1. The comparator was inconsistent. For two cards with no time it returned
 *    1 for both `cmp(a, b)` and `cmp(b, a)` — a comparator that says each of
 *    two things comes after the other. Sort is allowed to do anything with
 *    that, and did: cards changed places for no reason.
 *
 * 2. Dropping a card set its time to "when the previous one ends", and the
 *    list is then re-sorted by time. Drop something between a 9am thing that
 *    runs two hours and a 10am thing and its new time is 11am — *after* the
 *    card it was dropped in front of. The re-sort then moved it there. The
 *    card did not go where it was dropped, which is the whole contract of
 *    dragging.
 *
 * 3. A card whose time is cleared sorts to the end. That is fine, but nothing
 *    said so, and on a long day it reads as the card vanishing.
 */

import { minutesOf } from './minutes.js';

const two = (n) => String(n).padStart(2, '0');

/** "09:30:00" -> 570. Null for anything that is not a time. */
export const asMinutes = (time) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
    if (!m) return null;
    const value = Number(m[1]) * 60 + Number(m[2]);
    return Number.isFinite(value) ? value : null;
};

/** 570 -> "09:30:00", clamped to the day. */
export const asTime = (minutes) => {
    const m = Math.max(0, Math.min(1439, Math.round(minutes)));
    return `${two(Math.floor(m / 60))}:${two(m % 60)}:00`;
};

/**
 * How the day is ordered: things to do first, in time order, untimed last,
 * then the brainstorm board.
 *
 * Every branch returns the opposite for the opposite argument, which is the
 * one thing a comparator has to do and the one thing this did not.
 */
export const compareItems = (a, b) => {
    if (Boolean(a.is_brainstorm) !== Boolean(b.is_brainstorm)) {
        return a.is_brainstorm ? 1 : -1;
    }
    if (a.is_brainstorm) return 0;

    const at = asMinutes(a.start_time);
    const bt = asMinutes(b.start_time);
    // Both untimed: neither comes first. Saying "a after b" *and* "b after a"
    // is what made the board shuffle itself.
    if (at === null && bt === null) return 0;
    if (at === null) return 1;
    if (bt === null) return -1;
    return at - bt;
};

/** How long a card takes, in minutes, defaulting to an hour. */
export const lengthOf = (item) => minutesOf(item?.duration) || 60;

/**
 * A time for a card dropped between two others — strictly after the one
 * above it and strictly before the one below, so that re-sorting by time
 * leaves it exactly where it was dropped.
 *
 * The old rule was "when the previous one ends", which is not between
 * anything and is routinely after `next`.
 */
export const timeBetween = (prev, next) => {
    const before = prev ? asMinutes(prev.start_time) : null;
    const after = next ? asMinutes(next.start_time) : null;

    // Dropped at the top of an empty day.
    if (before === null && after === null) return '09:00:00';
    // Dropped above everything: an hour before the first, or 9am.
    if (before === null) return asTime(Math.max(0, after - 60));
    // Dropped at the end: when the one above it finishes.
    if (after === null) return asTime(before + lengthOf(prev));

    const ends = before + lengthOf(prev);
    // Room to run its full length and still start before the next one.
    if (ends < after) return asTime(ends);
    // No room: halfway between the two, which is at least somewhere between
    // them. If even that collides, the day is packed to the minute and the
    // card takes the minute after the one above it.
    const middle = Math.floor((before + after) / 2);
    return asTime(middle > before ? middle : before + 1);
};
