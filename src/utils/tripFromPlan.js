/**
 * Growing a trip out of the days you have already worked out.
 *
 * The Atlas assumes a trip arrives whole: you know where you are going and
 * when, and the days follow from the dates. That is one way trips get planned
 * and it is not hers. Hers starts as a good Saturday in Lisbon, then a day
 * trip out to Sintra, then a Sunday, and at some point the pile of days is a
 * trip — and until now the only way to say so was to make an empty expedition,
 * set its dates by hand to cover days that already existed, and send each
 * itinerary across one at a time hoping the dates lined up.
 *
 * So: an itinerary can start a trip, and a trip can be stretched to take an
 * itinerary that falls outside it.
 */

import { datesBetween } from './tripDates.js';

const day = (value) => {
    const text = String(value ?? '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

/**
 * Somewhere to call a trip made from one day.
 *
 * The itinerary's location if it has one — that is a place name she typed,
 * which is what a trip is named after. Otherwise its title, which is at least
 * hers. "New Expedition" is what the button gives you when it knows nothing,
 * and it should not be what you get when it knows something.
 *
 * Only the first part of an address: "Kala Ghoda, Fort, Mumbai" is a corner,
 * not a trip.
 */
export const tripName = (plan) => {
    const where = String(plan?.location || '').split(',')[0].trim();
    if (where) return where;
    const title = String(plan?.title || '').trim();
    return title || 'New Expedition';
};

/**
 * The trip an itinerary would start: one day long, on its date.
 *
 * Deliberately one day rather than a guessed week. It grows by having days
 * sent to it, and a trip that starts as a fortnight of empty days is a trip
 * you have to tidy before you can use it.
 */
export const tripSeed = (plan) => {
    const date = day(plan?.planned_date);
    return {
        destination: tripName(plan),
        start_date: date,
        end_date: date,
        status: 'Planned',
    };
};

/**
 * How a trip has to change to hold this date, or null if it already does.
 *
 * Only ever widens. A trip is not shortened because something was sent to the
 * middle of it, and the days already in it are not touched.
 */
export const stretch = (trip, date) => {
    const want = day(date);
    if (!want) return null;

    const start = day(trip?.start_date);
    const end = day(trip?.end_date) || start;

    // A trip with no dates at all becomes a one-day trip on that date.
    if (!start) return { start_date: want, end_date: want };
    if (want >= start && want <= end) return null;

    return {
        start_date: want < start ? want : start,
        end_date: want > end ? want : end,
    };
};

/** The dates a stretch adds, which are the day rows that have to be created. */
export const newDates = (trip, next) => {
    if (!next) return [];
    const had = new Set(datesBetween(trip?.start_date, trip?.end_date || trip?.start_date));
    return datesBetween(next.start_date, next.end_date).filter((d) => !had.has(d));
};

/**
 * What stretching would mean, said before it is done.
 *
 * A day either side is a nudge; three weeks either side is a different trip,
 * and quietly turning a long weekend into a month of empty days is not a
 * thing to do on her behalf without saying so.
 */
export const describeStretch = (trip, date) => {
    const next = stretch(trip, date);
    if (!next) return { needed: false, next: null, added: [], why: null };

    const added = newDates(trip, next);
    const before = day(trip?.start_date);
    const where = !before ? 'start' : (day(date) < before ? 'earlier' : 'later');

    return {
        needed: true,
        next,
        added,
        why: !before
            ? 'That trip has no dates yet. This would set them to this day.'
            : `That day is ${where} than the trip runs. This would extend it and add ${added.length} ${added.length === 1 ? 'day' : 'days'}.`,
    };
};
