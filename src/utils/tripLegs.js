/**
 * The shape of a trip: which city, for which stretch of days.
 *
 * A trip is not a list of days, it is a handful of legs — five days in Goa,
 * then four in Kerala — and the days are a consequence. The spreadsheet knew
 * this: its City row was a merged cell across however many columns a leg
 * covered. Storing a city per day loses the shape, and the shape is the thing
 * you plan with before you plan any individual day.
 *
 * Everything here is pure, because the interesting parts — where the gaps are,
 * where two legs claim the same night, which nights have nowhere booked — are
 * exactly the arithmetic that is easy to get subtly wrong and hard to notice.
 */

import { nightsOf } from './tripCosts.js';

const DAY = 86400000;

const parse = (value) => {
    if (!value) return null;
    const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
};

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Every date a leg covers, inclusive at both ends.
 *
 * Deliberately different from a stay: a hotel booked the 16th to the 19th is
 * three nights, but a city visited the 16th to the 19th is four days — you are
 * still there on the day you fly out.
 */
export const daysOfLeg = (leg) => {
    const from = parse(leg?.start_date);
    const to = parse(leg?.end_date);
    if (!from || !to || to < from) return [];

    const out = [];
    const cursor = new Date(from);
    while (cursor <= to && out.length < 400) {
        out.push(iso(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return out;
};

/** Which leg covers a date. The earliest-starting one wins a tie. */
export const legOn = (legs = [], date) => {
    const key = String(date).slice(0, 10);
    const hits = legs.filter((leg) => daysOfLeg(leg).includes(key));
    if (!hits.length) return null;
    return [...hits].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[0];
};

/**
 * The problems worth knowing about before planning a single day.
 *
 * Three kinds, and they are different failures:
 *
 *   unassigned  a day of the trip with no city — you have not decided yet
 *   overlap     two legs claiming the same day — you cannot be in both
 *   unhoused    a night with a city but nowhere booked to sleep
 *
 * The last one is the one that actually ruins a trip, and it is invisible
 * until you check every day card in turn.
 */
export const routeGaps = (tripDates = [], legs = [], stays = []) => {
    const dates = tripDates.map((d) => String(d).slice(0, 10));
    const covered = new Map();

    for (const leg of legs) {
        for (const date of daysOfLeg(leg)) {
            if (!covered.has(date)) covered.set(date, []);
            covered.get(date).push(leg);
        }
    }

    const housed = new Set();
    for (const stay of stays) for (const night of nightsOf(stay)) housed.add(night);

    const unassigned = dates.filter((d) => !covered.has(d));
    const overlaps = dates.filter((d) => (covered.get(d) || []).length > 1);

    // The last date of a trip is a travel day, not a night you need a bed for.
    const nights = dates.slice(0, -1);
    const unhoused = nights.filter((d) => covered.has(d) && !housed.has(d));

    return { unassigned, overlaps, unhoused };
};

/**
 * Each leg with what is actually planned in it.
 *
 * `costsByDate` is the per-day per-person total keyed by date, so the roll-up
 * agrees with the day cards by construction rather than by a second, parallel
 * calculation that can drift away from them.
 */
export const summariseLegs = (legs = [], { itemsByDate = {}, costsByDate = {}, weatherByDate = {}, stays = [] } = {}) => {
    const ordered = [...legs].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

    return ordered.map((leg) => {
        const dates = daysOfLeg(leg);
        const nights = Math.max(0, dates.length - 1);

        const highs = dates.map((d) => weatherByDate[d]?.high).filter((v) => typeof v === 'number');
        const lows = dates.map((d) => weatherByDate[d]?.low).filter((v) => typeof v === 'number');
        const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

        const cost = dates.reduce((sum, d) => sum + (costsByDate[d] || 0), 0);
        const planned = dates.reduce((sum, d) => sum + (itemsByDate[d]?.length || 0), 0);

        const lodging = stays.filter((s) => nightsOf(s).some((n) => dates.includes(n)));

        return {
            leg,
            dates,
            days: dates.length,
            nights,
            high: avg(highs),
            low: avg(lows),
            // Rounded once, at the end: summing pre-rounded day totals is how a
            // roll-up quietly stops matching the cards it is rolling up.
            cost: Math.round(cost * 100) / 100,
            planned,
            lodging,
        };
    });
};
