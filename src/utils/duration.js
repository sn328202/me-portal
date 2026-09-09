/**
 * How long a thing takes, as two numbers rather than a sentence.
 *
 * The field was free text, so it holds "2 hours", "90 min", "1:30", "2" and
 * "a couple of hours". Every one of those has to be guessed at before the day
 * can be added up, and the guessing is where the arithmetic quietly goes
 * wrong: a bare "2" is two hours in a duration box and two minutes to anyone
 * reading it, and "a couple of hours" is nothing at all.
 *
 * Hours and minutes, picked rather than typed, removes the guess at the point
 * where it is cheapest to remove — before it is stored. What is already
 * stored still parses, because `minutesOf` has always coped; new values are
 * written as "H:MM", which is the one form nothing has ever had to guess at.
 */

import { minutesOf } from './minutes.js';

/** The hours and minutes behind whatever is in the field. */
export const splitDuration = (duration) => {
    const mins = minutesOf(duration);
    if (!mins) return { hours: 0, minutes: 0 };
    return { hours: Math.floor(mins / 60), minutes: mins % 60 };
};

/**
 * Two numbers back into what the column stores.
 *
 * Zero and zero is null, not "0:00" — a card with no length set and a card
 * that takes no time are different things, and only one of them is real.
 */
export const joinDuration = (hours, minutes) => {
    const h = Math.max(0, Math.min(23, Math.trunc(Number(hours) || 0)));
    const m = Math.max(0, Math.min(59, Math.trunc(Number(minutes) || 0)));
    if (!h && !m) return null;
    return `${h}:${String(m).padStart(2, '0')}`;
};

/** The choices in the minutes box. Five is fine enough for a day. */
export const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/**
 * The choices in the hours box.
 *
 * It stopped at twelve, on the reasoning that nothing on a day plan runs half
 * a day. Long-haul does. A flight that is in the air when midnight passes now
 * arrives as a card filling a whole day, and a picker that could not say more
 * than twelve hours could not describe what the Ticket Book had already
 * written — open it to edit anything else and the length was silently halved.
 *
 * Twenty-three is the true ceiling: `joinDuration` clamps there, and a day
 * item's start and end are times *of day*, so a day is all one can hold.
 */
export const HOUR_STEPS = Array.from({ length: 24 }, (_, i) => i);
