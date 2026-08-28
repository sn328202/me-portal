/**
 * When to leave, and where a new card lands.
 *
 * A drive time on its own answers the wrong question. "45 min drive" between
 * a lunch and a 7pm table tells you the gap is crossable; it does not tell
 * you the thing you actually want at 6pm, which is whether you can still
 * order dessert. That is one subtraction away and nobody does it in their
 * head reliably, least of all while sitting in a restaurant.
 *
 * So the connector between two cards says "leave by 18:15" whenever both
 * halves are known, and says so louder when the card above it is still
 * running at that point.
 */

import { asMinutes, asTime, lengthOf } from './dayOrder.js';

/**
 * A drive time in minutes.
 *
 * Distinct from `minutesOf` in two ways that matter here. Google answers in
 * compound form — "1 hour 5 mins" — and reading only the first number loses
 * the five. And a bare number typed into a travel box is minutes: nobody
 * means "3 hours" when they type 3 into the gap between two dinners, though
 * they very much might when they type it into a duration.
 */
export const driveMinutes = (text) => {
    const s = String(text ?? '').trim();
    if (!s) return null;

    const clock = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

    let total = 0;
    let seen = false;
    // Every number-and-unit pair, so compound answers add up.
    const pairs = /(\d+(?:\.\d+)?)\s*(h(?:ours?|rs?)?|m(?:ins?|inutes?)?)\b/gi;
    let m;
    while ((m = pairs.exec(s)) !== null) {
        const value = Number(m[1]);
        if (!Number.isFinite(value)) continue;
        total += /^h/i.test(m[2]) ? value * 60 : value;
        seen = true;
    }
    if (seen) return total > 0 ? Math.round(total) : null;

    const bare = /(\d+(?:\.\d+)?)/.exec(s);
    if (!bare) return null;
    const value = Number(bare[1]);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
};

/**
 * When to set off from `item` to reach `next` on time.
 *
 * Returns null rather than guessing: no drive time, or nothing to be on time
 * for, and there is nothing honest to show.
 *
 * `tight` is the second half of what she asked for — it needs the length of
 * the card as well as the drive. If the thing you are at does not finish
 * until after you were supposed to leave, the leave-by time is still correct
 * and still the one you want, but it is now a warning rather than a note.
 */
export const departAt = (item, next, travelText) => {
    const drive = driveMinutes(travelText);
    if (drive === null) return null;

    const arrive = next ? asMinutes(next.start_time) : null;
    if (arrive === null) return null;

    const leave = arrive - drive;
    // A drive longer than the whole gap: the day does not work, and pushing
    // the leave-by time into yesterday would not be the way to say so.
    if (leave < 0) return null;

    const start = asMinutes(item?.start_time);
    const ends = start === null ? null : start + lengthOf(item);

    return {
        time: asTime(leave),
        minutes: leave,
        // Only claimable when the card actually has a length to run past.
        tight: ends !== null && ends > leave,
    };
};

/**
 * The next free time on a day: when the last thing on it finishes.
 *
 * Everything added used to arrive at 09:00 or with no time at all, which on
 * a day that already runs to six o'clock means the new card lands in the
 * middle of the morning and has to be dragged the length of the board. The
 * end of the day is where a new thing almost always belongs, and it is the
 * one place from which every other position is a short drag.
 */
export const nextSlot = (timelineItems = [], fallback = '09:00:00') => {
    let latest = null;
    let latestItem = null;
    for (const item of timelineItems) {
        if (item?.is_brainstorm) continue;
        const start = asMinutes(item.start_time);
        if (start === null) continue;
        if (latest === null || start >= latest) {
            latest = start;
            latestItem = item;
        }
    }
    if (latest === null) return fallback;

    const after = latest + lengthOf(latestItem);
    // A day that already runs to midnight has no next slot; sitting on the
    // last minute is better than wrapping round to the small hours.
    return asTime(Math.min(after, 23 * 60 + 59));
};
