/**
 * The portal's own days, as calendar events.
 *
 * "Export the itinerary to the calendar" is the obvious ask and the wrong
 * shape. Exporting means a file that goes stale the moment the plan changes,
 * or an OAuth grant that lets the portal write into Google Calendar — a
 * write scope for something that only ever needed to be read.
 *
 * The Chronometer already merges several calendars into one agenda. The
 * portal's days are just another source, and it is the one source that needs
 * no fetching, no address and no permission: it is the same database, the
 * same user, one query away. Change an itinerary and the Chronometer shows
 * the change on its next refresh, because there is no copy to go stale.
 *
 * Everything here is pure, so what lands in the agenda is decided in one
 * tested place rather than inside a request handler.
 */

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '').slice(0, 10));

/** A local wall-clock date and time as an ISO instant. */
const at = (date, time) => {
    const d = String(date).slice(0, 10);
    const t = String(time || '00:00:00').slice(0, 8).padEnd(8, '0');
    return `${d}T${t}`;
};

const plus = (iso, minutes) => new Date(new Date(iso).getTime() + minutes * 60000).toISOString();

/** How long a stop runs, from an end time if there is one, else an hour. */
const spanOf = (start, end) => {
    if (!end) return 60;
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    const mins = Math.round((b - a) / 60000);
    // An end before its start is a typo, not a negative event.
    return mins > 0 ? mins : 60;
};

/**
 * Itinerary items as events.
 *
 * Only what is actually scheduled: an item with no time is a thing she has
 * not decided when to do, and a calendar is the wrong place to argue about
 * it. Brainstorm cards never come across at all — they are maybes.
 */
export const itineraryEvents = (plans = [], itemsByPlan = {}, { source, color } = {}) => {
    const out = [];
    for (const plan of plans) {
        if (!isDate(plan?.planned_date)) continue;
        if (plan?.archived_at) continue;

        for (const item of itemsByPlan[plan.id] || []) {
            if (item?.is_brainstorm || !item?.start_time) continue;
            const title = String(item.activity || '').trim();
            if (!title) continue;

            const start = at(plan.planned_date, item.start_time);
            out.push({
                id: `plan-item-${item.id}`,
                title,
                start: new Date(start).toISOString(),
                end: plus(start, 60),
                allDay: false,
                location: item.location || null,
                status: null,
                // The day it belongs to, so the agenda can say where it came
                // from without her having to remember.
                source: source || plan.title || 'Itinerary',
                color: color || null,
            });
        }
    }
    return out;
};

/**
 * Trips as events: the trip itself across its dates, and each timed stop.
 *
 * The banner is the useful half — "India (Goa / Kerala)" lying across a
 * fortnight is the thing you want to see when someone asks if you are free
 * in December, and no individual stop tells you that.
 */
export const tripEvents = (trips = [], daysByTrip = {}, itemsByDay = {}, { source, color } = {}) => {
    const out = [];

    for (const trip of trips) {
        const name = String(trip?.destination || '').trim() || 'Expedition';

        if (isDate(trip?.start_date)) {
            const from = String(trip.start_date).slice(0, 10);
            const to = isDate(trip?.end_date) ? String(trip.end_date).slice(0, 10) : from;
            out.push({
                id: `trip-${trip.id}`,
                title: name,
                start: new Date(`${from}T00:00:00`).toISOString(),
                // All-day events end at the start of the following day, which
                // is how every calendar reads an inclusive last day.
                end: new Date(new Date(`${to}T00:00:00`).getTime() + 86400000).toISOString(),
                allDay: true,
                location: null,
                status: null,
                source: source || 'Trips',
                color: color || null,
            });
        }

        for (const day of daysByTrip[trip.id] || []) {
            if (!isDate(day?.date)) continue;
            for (const item of itemsByDay[day.id] || []) {
                const title = String(item?.title || '').trim();
                if (!title || !item?.start_time) continue;

                const start = at(day.date, item.start_time);
                out.push({
                    id: `trip-item-${item.id}`,
                    title,
                    start: new Date(start).toISOString(),
                    end: plus(start, spanOf(start, item.end_time ? at(day.date, item.end_time) : null)),
                    allDay: false,
                    location: item.location || day.city || null,
                    status: null,
                    source: source || name,
                    color: color || null,
                });
            }
        }
    }

    return out;
};

/** Only what falls in the window the agenda is showing. */
export const within = (events = [], from, to) => events.filter((e) => {
    const t = new Date(e.start).getTime();
    return Number.isFinite(t) && t >= from && t <= to;
});
