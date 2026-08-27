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

/** Every leg claiming a date, in order. Usually one; on a travel day, two. */
export const legsOn = (legs = [], date) => {
    const key = String(date).slice(0, 10);
    return legs
        .filter((leg) => daysOfLeg(leg).includes(key))
        .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
};


/* Things people write in a City field that are not places. Her first leg is
   genuinely called "Air Travel", and it is a real leg — three days of packing
   and outfits — it just cannot be geocoded and should not pretend to be a
   city you are sightseeing in. */
const TRAVEL_WORDS = /^(air ?travel|travel|travel ?day|flight|flying|airplane|plane|in ?transit|transit|driving|road ?trip|train)$/i;

export const isTravelLeg = (leg) => TRAVEL_WORDS.test(String(leg?.city || '').trim());

/**
 * Where a leg actually puts you.
 *
 * A normal leg puts you in its own city. A travel leg puts you in whatever
 * comes next — which is the answer the weather job needs, because looking up
 * the forecast for "Air Travel" returns a real place somewhere in the world
 * and it is not the one you are flying to. Her Air Travel leg was showing
 * 46°/28° for late December in India.
 */
export const legDestination = (leg, legs = []) => {
    if (!isTravelLeg(leg)) return leg?.city || '';

    const real = legs.filter((l) => !isTravelLeg(l) && l.city);
    const end = String(leg?.end_date || '').slice(0, 10);

    const next = real
        .filter((l) => String(l.start_date).slice(0, 10) >= end)
        .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[0];
    if (next) return next.city;

    // Nothing after it: this is the flight home, so the last real place is
    // the honest answer for what the weather was like around it.
    const previous = [...real]
        .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0];
    return previous?.city || '';
};

/** "Air Travel → Mumbai" — her own words, plus where they lead. */
export const legLabel = (leg, legs = []) => {
    const city = leg?.city || '';
    if (!isTravelLeg(leg)) return city;
    const to = legDestination(leg, legs);
    return to ? `${city} → ${to}` : city;
};

/**
 * What to show as the city on a given date.
 *
 * Two legs claim a handover day and each may already carry an arrow, so
 * naively joining them gives "Air Travel → Mumbai → Mumbai". Consecutive
 * repeats collapse.
 */
export const cityLabelOn = (legs = [], date) => {
    const parts = [];
    for (const leg of legsOn(legs, date)) {
        for (const piece of legLabel(leg, legs).split(' → ')) {
            if (piece && piece !== parts[parts.length - 1]) parts.push(piece);
        }
    }
    return parts.join(' → ');
};

/**
 * A day where one leg ends and the next begins.
 *
 * This is how a person actually enters a trip — Mumbai the 25th to the 27th,
 * Kerala the 27th to the 2nd — because you arrive somewhere on the day you
 * leave somewhere else. It is a handover, not a mistake, and calling it a
 * clash means the warning panel cries wolf on a correctly entered trip.
 */
export const isHandover = (legs = [], date) => {
    const key = String(date).slice(0, 10);
    const hits = legsOn(legs, key);
    if (hits.length !== 2) return false;
    const ending = hits.filter((l) => String(l.end_date).slice(0, 10) === key).length;
    const starting = hits.filter((l) => String(l.start_date).slice(0, 10) === key).length;
    return ending === 1 && starting === 1;
};

/**
 * Which leg a date belongs to.
 *
 * On a handover the city you are arriving into wins: that is where the evening
 * happens, where the bed is, and whose forecast decides what the day is like.
 */
export const legOn = (legs = [], date) => {
    const key = String(date).slice(0, 10);
    const hits = legsOn(legs, key);
    if (!hits.length) return null;
    const arriving = hits.find((l) => String(l.start_date).slice(0, 10) === key);
    return arriving || hits[0];
};

/**
 * Legs as bars that do not sit on top of each other.
 *
 * The facts about a leg want its days counted inclusively; a bar drawn across
 * a grid wants each column owned by exactly one leg, or the handover day makes
 * the row two deep for no reason. So a leg gives up its last day to whichever
 * leg starts on it.
 */
export const legBands = (legs = []) => {
    const ordered = [...legs].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
    const starts = new Set(ordered.map((l) => String(l.start_date).slice(0, 10)));

    return ordered.map((leg) => {
        const dates = daysOfLeg(leg);
        const last = dates[dates.length - 1];
        const trimmed = dates.length > 1 && starts.has(last) && String(leg.start_date).slice(0, 10) !== last
            ? dates.slice(0, -1)
            : dates;
        return { leg, dates: trimmed };
    });
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
    const handovers = dates.filter((d) => isHandover(legs, d));
    const overlaps = dates.filter(
        (d) => (covered.get(d) || []).length > 1 && !handovers.includes(d)
    );

    // The last date of a trip is a travel day, not a night you need a bed for.
    const nights = dates.slice(0, -1);
    const unhoused = nights.filter((d) => covered.has(d) && !housed.has(d));

    return { unassigned, overlaps, unhoused, handovers };
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
