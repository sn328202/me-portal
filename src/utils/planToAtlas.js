/**
 * Sending a Daydream itinerary into an Atlas trip, as one of its days.
 *
 * The two halves of the portal have always described the same thing at
 * different scales: a day plan is an hour-by-hour Saturday, a trip day is one
 * column of a fortnight. Working a day out in the Daydream and then typing it
 * again into the Atlas is the sort of duplication that makes people stop using
 * one of the two.
 *
 * Which day it lands on is not a question: the plan has a date, and the trip
 * has a day with that date. Asking would be asking her to repeat herself.
 *
 * Everything here is pure so the awkward parts — free-text durations, an end
 * time that runs past midnight, brainstorm cards with no time at all — can be
 * tested without a database.
 */

/* Words that make a plan a meal rather than a thing to do. The Atlas keeps
   food in its own cost bucket, so guessing here is worth it; guessing wrong
   costs one dropdown. */
const FOOD = /\b(breakfast|brunch|lunch|dinner|supper|coffee|drinks?|cocktails?|wine|tasting|bakery|cafe|café|restaurant|bar|eat|eating|snack|dessert)\b/i;

/** 'todo' or 'food', guessed from what she called it. */
export const kindOf = (title) => (FOOD.test(String(title || '')) ? 'food' : 'todo');

/**
 * A free-text duration in minutes, or null.
 *
 * The Daydream never constrained this field, so it holds "2 hours", "1:30",
 * "90 min" and bare numbers. A bare number is hours — that is what the day
 * planner's own arithmetic assumes — except that nobody means ninety hours, so
 * anything above twelve is read as minutes.
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

const toMinutes = (time) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const toTime = (minutes) => {
    const m = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
    // 24:00 is not a time Postgres takes, and midnight at the end of a day is
    // the start of the next one as far as the clock is concerned.
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
};

/** "09:00:00" plus a duration, or null when either is missing. */
export const endTime = (start, duration) => {
    const from = toMinutes(start);
    const length = minutesOf(duration);
    if (from === null || !length) return null;
    return toTime(from + length);
};

/** The day of a trip that a plan belongs on, matched on the date. */
export const dayFor = (plannedDate, days = []) => {
    const want = String(plannedDate || '').slice(0, 10);
    if (!want) return null;
    return days.find((d) => String(d.date).slice(0, 10) === want) || null;
};

/**
 * A plan's items as Atlas day items.
 *
 * Timed items keep their hour; brainstorm cards keep nothing but their name
 * and go to the end, where the Atlas timeline has an Unscheduled row waiting
 * for exactly this. Dropping them would be losing the half of a day plan that
 * was still being decided.
 */
export const atlasItemsFrom = (planItems = []) => {
    // A card with no name is a card someone started and abandoned. Carrying it
    // across as "Untitled" moves the mess rather than the plan.
    const named = planItems.filter((i) => String(i.activity || '').trim());

    const timed = named
        .filter((i) => !i.is_brainstorm && i.start_time)
        .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    const loose = named.filter((i) => i.is_brainstorm || !i.start_time);

    return [...timed, ...loose].map((i, index) => {
        const scheduled = !i.is_brainstorm && i.start_time;
        return {
            title: String(i.activity).trim(),
            kind: kindOf(i.activity),
            start_time: scheduled ? String(i.start_time).slice(0, 8) : null,
            end_time: scheduled ? endTime(i.start_time, i.duration) : null,
            cost: i.cost === '' || i.cost == null ? null : Number(i.cost),
            // The description crosses too. It was the one field she could
            // write and not send.
            notes: String(i.notes || '').trim() || null,
            /* And whether the price is split or each. The Atlas has always had
               this and the Daydream had nowhere to say it, so a dinner for
               four arrived as "split" whatever she meant. Null is true, which
               is what the Atlas already assumes. */
            cost_shared: i.cost_shared === false ? false : true,
            // The Atlas has both, and the Daydream fills whichever it managed
            // to get — a link from a place, a location from a search.
            link: i.link || null,
            location: i.location || null,
            sort_order: index,
        };
    });
};

/**
 * What sending would do, said before it is done.
 *
 * The plan may have no date, or a date the trip does not cover, and both are
 * ordinary rather than exceptional — a day dreamt up before the trip's dates
 * were pinned down is the normal way round.
 */
export const describeSend = (plan, days = [], planItems = []) => {
    const items = atlasItemsFrom(planItems);
    const day = dayFor(plan?.planned_date, days);

    if (!plan?.planned_date) {
        return { ok: false, day: null, items, why: 'This itinerary has no date yet, so there is no day to put it on. Pick one below, or give the plan a date.' };
    }
    if (!day) {
        return { ok: false, day: null, items, why: 'That date is not one of this trip’s days. Pick a day below, or change the trip’s dates.' };
    }
    if (!items.length) {
        return { ok: false, day, items, why: 'This itinerary has nothing in it yet.' };
    }
    return { ok: true, day, items, why: null };
};
