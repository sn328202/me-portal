/**
 * What a trip costs, per person.
 *
 * The spreadsheet had five cost lines per day and a running total, and every
 * figure had to be divided by hand before it was typed in — a hotel room at
 * $240 for two nights across three people was arithmetic done in your head,
 * in the cell, with no record of which it was. Change the party size and every
 * number is silently wrong.
 *
 * So the numbers here carry a flag saying whether they are shared or already
 * per-person, and the division happens once, here, where it can be tested.
 *
 * Money is handled in cents. 0.1 + 0.2 is not 0.3 in binary floating point,
 * and a running total that drifts by a cent a day over a three week trip is
 * exactly the kind of wrong that erodes trust in the whole feature.
 */

const BUCKETS = ['lodging', 'food', 'excursions', 'transport', 'points'];

export const COST_BUCKETS = BUCKETS;

/** Bucket -> the item kinds that roll into it. */
const KIND_BUCKET = {
    todo: 'excursions',
    food: 'food',
    lodging: 'lodging',
    transport: 'transport',
    other: 'excursions',
};

const cents = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
};

/** Cents back to a number of currency units, rounded to the penny. */
const money = (c) => Math.round(c) / 100;

/**
 * Split a cost across a party.
 *
 * `shared` costs are divided; per-person costs are not. A party of zero or a
 * missing party size means one person — better a total that reads as one
 * person's than a division by zero.
 */
export const perPerson = (amount, shared, partySize) => {
    const people = Math.max(1, Math.floor(Number(partySize) || 1));
    const c = cents(amount);
    return shared ? c / people : c;
};

/**
 * The nights a stay covers, as 'YYYY-MM-DD' strings.
 *
 * Half-open, the way hotels count: 16th to 19th is three nights — the 16th,
 * 17th and 18th. The 19th is a checkout morning, not a night, and charging it
 * would silently inflate every trip by one night's lodging.
 */
export const nightsOf = (stay) => {
    if (!stay?.check_in || !stay?.check_out) return [];
    const from = new Date(`${String(stay.check_in).slice(0, 10)}T12:00:00`);
    const to = new Date(`${String(stay.check_out).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return [];

    const out = [];
    const cursor = new Date(from);
    while (cursor < to && out.length < 400) {
        out.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
        cursor.setDate(cursor.getDate() + 1);
    }
    return out;
};

/**
 * What each stay costs per person per night, keyed by date.
 *
 * The booking is entered as the whole thing — that is what the confirmation
 * email says — and spread evenly across its nights here.
 */
export const lodgingByNight = (stays = [], partySize = 1) => {
    const byDate = {};
    for (const stay of stays) {
        const nights = nightsOf(stay);
        if (!nights.length) continue;
        const each = perPerson(stay.cost, stay.cost_shared !== false, partySize) / nights.length;
        for (const night of nights) {
            byDate[night] = (byDate[night] || 0) + each;
        }
    }
    return byDate;
};

/** Which stay covers a given date, if any. */
export const stayOn = (stays = [], date) => {
    const key = String(date).slice(0, 10);
    return stays.find((s) => nightsOf(s).includes(key)) || null;
};

/**
 * One day's costs, in cents, per person.
 *
 * Returns each bucket separately as well as the total, because "where did the
 * money go" is the question a total cannot answer — and it is the question you
 * ask when a day comes out higher than expected.
 */
export const dayCost = (day, items = [], partySize = 1, lodgingTonight = 0) => {
    const shared = Boolean(day?.costs_are_shared);
    const buckets = {};

    for (const bucket of BUCKETS) {
        buckets[bucket] = perPerson(day?.[`cost_${bucket}`], shared, partySize);
    }

    // Priced slots roll into their bucket on top of whatever was entered on
    // the day line, so a day can be planned either way round: a lump sum for
    // food, or every meal priced individually, or both.
    for (const item of items) {
        if (item?.cost === null || item?.cost === undefined || item?.cost === '') continue;
        const bucket = KIND_BUCKET[item.kind] || 'excursions';
        buckets[bucket] += perPerson(item.cost, item.cost_shared !== false, partySize);
    }

    // A booking that spans nights lands on each of them, on top of anything
    // entered directly against the day.
    buckets.lodging += lodgingTonight;

    const total = BUCKETS.reduce((sum, b) => sum + buckets[b], 0);
    return { buckets, total };
};

/**
 * The whole trip, day by day, with a running total.
 *
 * `itemsByDay` is keyed by day id. Days arrive in whatever order the caller
 * has them; they are sorted by date here so the running total actually runs
 * forwards.
 */
export const tripCost = (days = [], itemsByDay = {}, partySize = 1, stays = []) => {
    const ordered = [...days].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const lodging = lodgingByNight(stays, partySize);

    let running = 0;
    const perDay = ordered.map((day) => {
        const night = lodging[String(day.date).slice(0, 10)] || 0;
        const { buckets, total } = dayCost(day, itemsByDay[day.id] || [], partySize, night);
        running += total;
        return {
            id: day.id,
            date: day.date,
            buckets: Object.fromEntries(BUCKETS.map((b) => [b, money(buckets[b])])),
            total: money(total),
            runningTotal: money(running),
        };
    });

    const totals = Object.fromEntries(BUCKETS.map((bucket) => [
        bucket,
        money(ordered.reduce((sum, day, i) => sum + cents(perDay[i].buckets[bucket]), 0)),
    ]));

    return {
        days: perDay,
        totals,
        perPerson: money(running),
        // The number you actually pay, as opposed to the number you budget per
        // head. Worth showing both: they differ by a factor most people can do
        // in their head and still get wrong under pressure.
        party: money(running * Math.max(1, Math.floor(Number(partySize) || 1))),
    };
};

/** "$1,240.50" — Intl, so a currency other than USD still reads correctly. */
export const formatMoney = (amount, currency = 'USD') => {
    const n = Number(amount) || 0;
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: n % 1 === 0 ? 0 : 2,
        }).format(n);
    } catch {
        // An unknown currency code should not take the page down with it.
        return `${currency} ${n.toFixed(2)}`;
    }
};
