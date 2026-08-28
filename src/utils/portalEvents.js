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

/**
 * The offset of a zone at a given instant, in milliseconds.
 *
 * Worked out by asking Intl what the wall clock reads there and subtracting.
 * No library, and it handles the summer-time changes a fixed offset cannot.
 */
const offsetAt = (utcMs, zone) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: zone,
            hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value])
    );
    const wall = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
    );
    return wall - utcMs;
};

/**
 * A wall-clock date and time in a named zone, as the instant it actually is.
 *
 * This is the whole reason the zone has to travel with the request. The
 * portal stores "11:00 on the 30th" with no zone at all, because that is what
 * a plan is — you are having lunch at eleven wherever you are standing. The
 * API runs on Vercel, which is UTC, so `new Date('2026-08-30T11:00:00')` on
 * the server meant eleven in the morning *in UTC*, and an eleven o'clock
 * lunch arrived in her agenda at four.
 *
 * Two passes, because the offset depends on the instant and the instant
 * depends on the offset. The second settles the hour either side of a clock
 * change.
 */
export const zonedInstant = (date, time, zone) => {
    const d = String(date).slice(0, 10);
    const [y, mo, dd] = d.split('-').map(Number);
    const t = String(time || '00:00:00').slice(0, 8).padEnd(8, '0');
    const [hh, mm, ss] = t.split(':').map(Number);

    const wall = Date.UTC(y, mo - 1, dd, hh || 0, mm || 0, ss || 0);
    if (!zone) return new Date(wall - offsetAt(wall, 'UTC')).toISOString();

    let utc = wall - offsetAt(wall, zone);
    utc = wall - offsetAt(utc, zone);
    return new Date(utc).toISOString();
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
export const itineraryEvents = (plans = [], itemsByPlan = {}, { source, color, zone } = {}) => {
    const out = [];
    for (const plan of plans) {
        if (!isDate(plan?.planned_date)) continue;
        if (plan?.archived_at) continue;

        for (const item of itemsByPlan[plan.id] || []) {
            if (item?.is_brainstorm || !item?.start_time) continue;
            const title = String(item.activity || '').trim();
            if (!title) continue;

            const start = zonedInstant(plan.planned_date, item.start_time, zone);
            out.push({
                id: `plan-item-${item.id}`,
                title,
                start,
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
export const tripEvents = (trips = [], daysByTrip = {}, itemsByDay = {}, { source, color, zone } = {}) => {
    const out = [];

    for (const trip of trips) {
        const name = String(trip?.destination || '').trim() || 'Expedition';

        if (isDate(trip?.start_date)) {
            const from = String(trip.start_date).slice(0, 10);
            const to = isDate(trip?.end_date) ? String(trip.end_date).slice(0, 10) : from;
            out.push({
                id: `trip-${trip.id}`,
                title: name,
                start: zonedInstant(from, '00:00:00', zone),
                // All-day events end at the start of the following day, which
                // is how every calendar reads an inclusive last day.
                end: new Date(new Date(zonedInstant(to, '00:00:00', zone)).getTime() + 86400000).toISOString(),
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

                const start = zonedInstant(day.date, item.start_time, zone);
                out.push({
                    id: `trip-item-${item.id}`,
                    title,
                    start,
                    end: plus(start, spanOf(start, item.end_time ? zonedInstant(day.date, item.end_time, zone) : null)),
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
