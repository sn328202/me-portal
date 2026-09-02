/**
 * Finding a trip in a shelf of them.
 *
 * Seven is already too many to scan, and the shelf only ever grows. The three
 * questions actually asked of it are "where's the one to X", "what's next",
 * and "what have I done" — so: a search box, and an order that answers the
 * second two without being asked.
 */

const day = (v) => String(v ?? '').slice(0, 10);

/** Loose enough to find "Annecy" by typing "annecy" or "Annécy". */
const fold = (s) => String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const searchTrips = (trips = [], query = '') => {
    const want = fold(query);
    if (!want) return trips;
    return trips.filter((t) => fold(t?.destination).includes(want)
        || fold(t?.status).includes(want));
};

export const SORTS = [
    { id: 'soonest', label: 'What’s next' },
    { id: 'date', label: 'Newest first' },
    { id: 'name', label: 'A–Z' },
    { id: 'length', label: 'Longest' },
];

const byDate = (a, b) => day(a?.start_date).localeCompare(day(b?.start_date));
const span = (t) => {
    const from = day(t?.start_date);
    const to = day(t?.end_date) || from;
    if (!from) return 0;
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
};

/**
 * The default order, which is a question rather than a direction.
 *
 * "Sorted by date" ascending puts 2023 at the top and the trip she is
 * packing for at the bottom, which is the least useful end of the list. What
 * is coming comes first, soonest first; what is done follows, most recent
 * first. Undated things sit between the two — they are neither over nor
 * imminent.
 */
const soonest = (trips, today) => {
    const now = day(today);
    const ahead = [];
    const undated = [];
    const behind = [];

    for (const t of trips) {
        const end = day(t?.end_date) || day(t?.start_date);
        if (!end) undated.push(t);
        else if (end >= now) ahead.push(t);
        else behind.push(t);
    }

    ahead.sort(byDate);
    behind.sort((a, b) => byDate(b, a));
    undated.sort((a, b) => String(a?.destination || '').localeCompare(String(b?.destination || '')));

    return [...ahead, ...undated, ...behind];
};

export const sortTrips = (trips = [], how = 'soonest', today = new Date().toISOString()) => {
    const list = [...trips];
    switch (how) {
        case 'date':
            return list.sort((a, b) => byDate(b, a));
        case 'name':
            return list.sort((a, b) => String(a?.destination || '')
                .localeCompare(String(b?.destination || ''), undefined, { sensitivity: 'base' }));
        case 'length':
            return list.sort((a, b) => span(b) - span(a) || byDate(b, a));
        default:
            return soonest(list, today);
    }
};

/** What to say when a search or a shelf turns up nothing. */
export const emptyBecause = ({ query, shelf, total }) => {
    if (query) return `Nothing matches “${query}”.`;
    if (total === 0) return 'No expeditions yet.';
    if (shelf && shelf !== 'all') return 'Nothing on this shelf.';
    return 'Nothing here.';
};
