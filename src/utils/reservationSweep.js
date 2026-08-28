/**
 * What has changed about the bookings, worked out from the bookings.
 *
 * There is no API that will tell you whether a table you hold is still held —
 * Resy and OpenTable do not offer one, and the confirmation email is the only
 * thing that ever arrives. So "refresh the statuses" cannot mean "go and ask".
 *
 * It can mean something honest instead: the clock has moved since these rows
 * were written, and that alone settles most of what is stale. A dinner that
 * was Tuesday is not "booked" any more; it either happened or it did not, and
 * nobody has said which. A free-cancellation deadline that passes is a fact
 * about money. Two tables at the same hour is a thing you did by accident.
 *
 * Nothing here writes. It produces a list of things to decide, because the one
 * thing this cannot know is whether she actually went.
 */

const DAY = 86400000;

const at = (value) => {
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
};

/** Bookings whose time has passed and which nobody has settled either way. */
export const unsettled = (reservations = [], now = Date.now()) => (
    reservations
        .filter((r) => r.status === 'booked' && at(r.starts_at) !== null && at(r.starts_at) < now)
        .sort((a, b) => at(b.starts_at) - at(a.starts_at))
);

/**
 * Free-cancellation deadlines: the ones about to pass, and the ones that
 * already have while the table is still held.
 *
 * `within` is in days, because a deadline four days out is not yet news.
 */
export const deadlines = (reservations = [], now = Date.now(), within = 3) => {
    const live = reservations.filter((r) => r.status === 'booked' && r.cancel_by);

    const soon = [];
    const missed = [];
    live.forEach((r) => {
        const by = at(r.cancel_by);
        if (by === null) return;
        if (by < now) missed.push(r);
        else if (by - now <= within * DAY) soon.push(r);
    });

    soon.sort((a, b) => at(a.cancel_by) - at(b.cancel_by));
    missed.sort((a, b) => at(b.cancel_by) - at(a.cancel_by));
    return { soon, missed };
};

/**
 * Two tables held within a couple of hours of each other.
 *
 * Not an error — holding two while deciding is a normal thing to do — but it
 * is the sort of thing that is only ever noticed by the restaurant.
 */
export const clashes = (reservations = [], now = Date.now(), hours = 2) => {
    const held = reservations
        .filter((r) => r.status === 'booked' && at(r.starts_at) !== null && at(r.starts_at) >= now)
        .sort((a, b) => at(a.starts_at) - at(b.starts_at));

    const pairs = [];
    for (let i = 1; i < held.length; i += 1) {
        const gap = at(held[i].starts_at) - at(held[i - 1].starts_at);
        if (gap <= hours * 3600000) pairs.push([held[i - 1], held[i]]);
    }
    return pairs;
};

/** Everything the sweep found, and whether it found anything at all. */
export const sweep = (reservations = [], now = Date.now()) => {
    const past = unsettled(reservations, now);
    const { soon, missed } = deadlines(reservations, now);
    const double = clashes(reservations, now);
    return {
        unsettled: past,
        soon,
        missed,
        clashes: double,
        count: past.length + soon.length + missed.length + double.length,
    };
};
