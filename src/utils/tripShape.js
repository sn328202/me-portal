/**
 * What shape a thing in the Atlas is.
 *
 * Since the Daydream merged in, the Atlas holds two kinds of thing that used
 * to live in two rooms: a week in Switzerland and a Saturday with Will. They
 * are the same record — a day IS a trip one day long — which is the whole
 * point, and it is also why the list needs a way to say which is which.
 *
 * The shape is read off the dates rather than kept in a column she has to
 * maintain. A flag can drift out of step with the dates; the dates cannot
 * drift out of step with themselves.
 */

const day = (value) => {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

/** How many days it covers. Zero when it has not been dated. */
export const spanOf = (trip) => {
    const from = day(trip?.start_date);
    const to = day(trip?.end_date) || from;
    if (!from) return 0;
    const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
    // An end before the start is a typo, not a negative trip.
    return days > 0 ? days : 1;
};

/**
 * Three shelves, because there are honestly three answers.
 *
 * A binary would have to put an undated thing somewhere it does not belong:
 * "Japan, sometime" is not a day, and "Stained Glass Workshop, sometime" is
 * not a trip. Neither is dated yet, and that is the true thing about both.
 */
export const shapeOf = (trip) => {
    const span = spanOf(trip);
    if (!span) return 'someday';
    return span > 1 ? 'trip' : 'day';
};

export const SHELVES = [
    { id: 'all', label: 'Everything' },
    { id: 'trip', label: 'Trips' },
    { id: 'day', label: 'Days' },
    { id: 'someday', label: 'Someday' },
];

/** What is on a shelf. */
export const onShelf = (trips, shelf) => {
    const list = trips || [];
    if (!shelf || shelf === 'all') return list;
    return list.filter((t) => shapeOf(t) === shelf);
};

/** How many are on each, so an empty shelf can say so before she opens it. */
export const shelfCounts = (trips) => {
    const counts = { all: 0, trip: 0, day: 0, someday: 0 };
    (trips || []).forEach((t) => {
        counts.all += 1;
        counts[shapeOf(t)] += 1;
    });
    return counts;
};

/** A line under the name, so a card says what it is without a badge. */
export const describeShape = (trip) => {
    const span = spanOf(trip);
    if (!span) return 'Not dated yet';
    if (span === 1) return 'One day';
    return `${span} days`;
};
