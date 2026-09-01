/**
 * Which day a booking belongs on, now that there is only one kind of day.
 *
 * The picker used to ask two questions in sequence — "a trip or an
 * itinerary?", then "which trip?" — and only then look for the day. Both of
 * those made sense when the Daydream and the Atlas were separate rooms. They
 * do not any more: a day *is* a one-day trip, so a day plan added to the Atlas
 * shows up as a trip, and choosing "An itinerary" listed the old room's rows
 * and found nothing.
 *
 * There is one question, and usually it answers itself: a booking knows its
 * date, so the day it lands on is the day with that date.
 */

const asDay = (value) => {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

/** Every day of every trip, flattened and labelled, in date order. */
export const dayChoices = (rows) => (rows || [])
    .map((row) => {
        const trip = row.atlas_trips || row.trip || {};
        return {
            id: row.id,
            date: asDay(row.date),
            city: row.city || null,
            tripId: row.trip_id ?? trip.id ?? null,
            trip: trip.destination || 'A trip',
        };
    })
    .filter((d) => d.date)
    .sort((a, b) => (a.date === b.date
        ? String(a.trip).localeCompare(String(b.trip))
        : (a.date < b.date ? -1 : 1)));

/**
 * The days that fall on a booking's date.
 *
 * Usually none or one. Two trips can overlap a date — a weekend inside a
 * longer trip, or an old trip never given an end — and when they do she has
 * to say which, rather than the first one silently winning.
 */
export const daysOn = (choices, date) => {
    const want = asDay(date);
    if (!want) return [];
    return (choices || []).filter((d) => d.date === want);
};

/** How a day reads in a list: which trip, and which day of it. */
export const labelDay = (day, pretty = (d) => d) => {
    if (!day) return '';
    const when = pretty(day.date);
    const where = [day.trip, day.city].filter(Boolean).join(' · ');
    return where ? `${where} — ${when}` : when;
};

/**
 * What to say when nothing matches.
 *
 * "No day matches" is true and useless. Which trips are near it is the thing
 * that lets her decide whether to stretch a trip's dates or just pick a day
 * by hand.
 */
export const nearestDays = (choices, date, within = 3) => {
    const want = asDay(date);
    if (!want) return [];
    const at = Date.parse(`${want}T00:00:00Z`);
    return (choices || [])
        .map((d) => ({ ...d, away: Math.round((Date.parse(`${d.date}T00:00:00Z`) - at) / 86400000) }))
        .filter((d) => Math.abs(d.away) <= within)
        .sort((a, b) => Math.abs(a.away) - Math.abs(b.away));
};
