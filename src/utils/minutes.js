/**
 * How long something takes, in minutes, from whatever she typed.
 *
 * The duration field was free text for years, so the stored values include
 * "2 hours", "90 min", "1:30", "2" and the odd "a couple of hours". New ones
 * are written as "H:MM" by the picker, but everything already saved still has
 * to add up.
 *
 * This is the one piece of `planToAtlas` worth keeping now the Daydream is
 * retired — the comparator, the duration picker, the share sheet and the Day
 * Builder all depend on it, and none of them have anything to do with moving
 * a plan into a trip. It is moved here **exactly as it was**: this stage
 * removes a room, it does not quietly change arithmetic that four modules and
 * five test files already agree on.
 *
 * (Its quirks are therefore preserved too. A bare number under 13 reads as
 * hours and over 12 as minutes, and a compound "1 hour 5 mins" reads as 1 —
 * which is why `departAt.js` has its own stricter reader for drive times.)
 */

export const minutesOf = (duration) => {
    const text = String(duration ?? '').trim();
    if (!text) return null;

    const clock = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

    const number = /(\d+(?:\.\d+)?)/.exec(text);
    if (!number) return null;
    const value = Number(number[1]);
    if (!Number.isFinite(value) || value <= 0) return null;

    if (/\b(m|min|mins|minute|minutes)\b/i.test(text)) return Math.round(value);
    if (/\b(h|hr|hrs|hour|hours)\b/i.test(text)) return Math.round(value * 60);

    return value > 12 ? Math.round(value) : Math.round(value * 60);
};
