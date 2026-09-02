/**
 * Where and when, as one list.
 *
 * These were two cards side by side — the cities, and the lodging — and she
 * saw the redundancy before I did: a booking already says which city you are
 * in and which nights it covers, so a separate row asserting the same city on
 * the same nights is the same fact typed twice.
 *
 * So the card is one list of stretches. A stretch is a leg — a city and the
 * days it owns, which is what the timeline's City bar draws — and whatever is
 * booked for those nights hangs underneath it, which is what the Lodging bar
 * draws. Both rows stay in the timeline; it is only the editing surface that
 * stops being two of them.
 *
 * The join is by date, which is how it already worked: `summariseLegs` has
 * been matching stays to legs by overlapping nights since it was written.
 * Nothing new is stored to make this list; it is a different arrangement of
 * facts that were already related.
 */

import { nightsOf } from './tripCosts.js';
import { daysOfLeg, isTravelLeg } from './tripLegs.js';

const day = (v) => String(v ?? '').slice(0, 10);

/**
 * The list, plus whatever it could not place.
 *
 * A booking whose nights no leg covers is not dropped on the floor. It is the
 * most interesting row on the page — it means she has booked somewhere she has
 * not yet said she is going — so it comes back separately for the card to
 * offer to turn into a leg.
 */
export const whereRows = (summary = [], stays = []) => {
    const placed = new Set();

    const rows = summary.map((row) => {
        /* Nights, not days. A leg's last date is the day you leave, and the
           night before that morning belongs to whoever you slept with — so
           matching on a leg's inclusive dates puts the Napa Airbnb under San
           Francisco *and* under Napa, because both legs claim the 1st. Every
           stay showed up twice, once in the stretch it belonged to and once
           in the one before it. */
        const nights = new Set((row.dates || []).slice(0, -1));
        const lodging = stays.filter((s) => nightsOf(s).some((n) => nights.has(n)));
        for (const stay of lodging) placed.add(stay.id);

        return {
            ...row,
            lodging,
            travel: isTravelLeg(row.leg),
            /* A travel leg is not a night she forgot to book — it is a
               red-eye, and asking where she is sleeping on it is the question
               that made the loose-ends panel cry wolf. */
            wantsBed: !isTravelLeg(row.leg) && row.nights > 0,
        };
    });

    const orphans = stays.filter((s) => !placed.has(s.id) && nightsOf(s).length > 0);
    return { rows, orphans };
};

/** Which nights of a leg still have nowhere booked. */
export const unhousedNights = (row) => {
    if (!row?.wantsBed) return [];
    const housed = new Set();
    for (const stay of row.lodging || []) for (const n of nightsOf(stay)) housed.add(n);
    // The last date of a leg is the day you leave, not a night you need a bed.
    return (row.dates || []).slice(0, -1).filter((d) => !housed.has(d));
};

/**
 * The leg a new booking implies.
 *
 * "Lodging fills in all the days, since you have to stay somewhere." A stay
 * booked the 2nd to the 5th means she is in that city on the 2nd, 3rd, 4th and
 * 5th — the day you check out is still a day you are there, the same way a
 * leg's last day is.
 *
 * Returns null when some leg already covers those nights: the point is to save
 * her typing a city she has already typed, not to add a second copy of it.
 */
export const legFromStay = (stay, city, legs = []) => {
    const from = day(stay?.check_in);
    const to = day(stay?.check_out);
    const name = String(city || '').trim();
    if (!from || !to || to <= from || !name) return null;

    const nights = nightsOf(stay);
    const covered = new Set();
    for (const leg of legs) for (const d of daysOfLeg(leg)) covered.add(d);
    if (nights.every((n) => covered.has(n))) return null;

    return { city: name, start_date: from, end_date: to };
};

/** What that would do, in words, before it does it. */
export const describeNewLeg = (leg) => (leg
    ? `This adds ${leg.city} to your route, ${leg.start_date} to ${leg.end_date}.`
    : '');
