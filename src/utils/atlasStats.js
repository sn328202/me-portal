/**
 * The Atlas, taken together.
 *
 * The map room shows every trip as a pin, which answers "where have I been"
 * beautifully and answers nothing else. The other questions a shelf of trips
 * raises are just as easy: how many countries, how much this all costs, and
 * whether the last one was dear or ordinary.
 *
 * Costs are per-trip totals worked out by `tripCost`, so a figure here and
 * the figure on the trip's own page can never disagree — this only adds them
 * up and divides.
 *
 * Everything is pure. What counts as "been" is a decision, not a lookup, and
 * it is made here where it can be tested rather than in a template.
 */

import { tripCost } from './tripCosts.js';
import { codeOf, flagOf } from './flags.js';

const day = (value) => {
    const text = String(value ?? '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

/**
 * A trip that has happened.
 *
 * By its dates rather than its status, because "Completed" is a thing she has
 * to remember to set and a date in the past is not. A trip with no end date
 * falls back to its start; a trip with neither has not happened, whatever it
 * says on it.
 */
export const hasHappened = (trip, today) => {
    const end = day(trip?.end_date) || day(trip?.start_date);
    return Boolean(end) && end < today;
};

/** Every distinct country across a set of legs, as { code, name, flag }. */
export const countriesOf = (legsByTrip = {}) => {
    const seen = new Map();
    for (const rows of Object.values(legsByTrip)) {
        for (const leg of rows || []) {
            const code = (leg?.country_code || codeOf(leg?.country) || '').toUpperCase();
            if (!code || code.length !== 2 || seen.has(code)) continue;
            seen.set(code, {
                code,
                name: leg.country || code,
                flag: flagOf(code),
            });
        }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * What one trip comes to, per person.
 *
 * Zero for a trip with nothing priced yet — which is most of them, most of the
 * time, and is why the average below is taken over the priced ones only.
 */
export const costOfTrip = (trip, days = [], itemsByDay = {}, stays = []) =>
    Number(tripCost(days, itemsByDay, trip?.party_size || 1, stays).perPerson) || 0;

/**
 * The shelf, summed.
 *
 * The average is over trips that have a cost, not over all of them. Four trips
 * where one is priced and three are empty ideas do not average to a quarter of
 * that one — they average to that one, and saying otherwise makes the number
 * useless exactly when she starts using the Atlas properly.
 */
export const atlasStats = ({ trips = [], legsByTrip = {}, costByTrip = {}, today }) => {
    const priced = trips
        .map((t) => ({ trip: t, cost: Number(costByTrip[t.id]) || 0 }))
        .filter((r) => r.cost > 0);

    const spend = priced.reduce((sum, r) => sum + r.cost, 0);
    const countries = countriesOf(legsByTrip);
    const been = trips.filter((t) => hasHappened(t, today));

    return {
        trips: trips.length,
        been: been.length,
        ahead: trips.length - been.length,
        countries,
        spend,
        priced: priced.length,
        average: priced.length ? spend / priced.length : 0,
        // The one that cost the most, for the line under the average. Null
        // rather than zero when nothing is priced: no answer is not £0.
        dearest: priced.length
            ? priced.reduce((a, b) => (b.cost > a.cost ? b : a))
            : null,
    };
};
