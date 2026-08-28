/**
 * Which itineraries are on the board, and which have been put away.
 *
 * The sidebar listed every day plan ever made, newest last, so a Saturday
 * from March sat between two things she is actually planning. The list only
 * grows, and a list that only grows stops being a list of what to do.
 *
 * Archiving rather than deleting, because a day that happened is the best
 * record there is of what a place was like and what it cost — it is exactly
 * what she opens when planning the next one.
 */

/** Today where she is, not in UTC — a date column has no timezone to convert. */
export const todayLocal = (now = new Date()) => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const isArchived = (plan) => Boolean(plan?.archived_at);

/**
 * A day that has been.
 *
 * Today is not past — a day you are in the middle of is the one you most want
 * on screen. A plan with no date is never past: it has not been scheduled, so
 * it cannot have been missed, and sweeping undated dreams into the archive is
 * how you lose the ones that were still ideas.
 */
export const hasBeen = (plan, today = todayLocal()) => {
    const date = String(plan?.planned_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    return date < today;
};

export const SHELVES = ['upcoming', 'past', 'archived', 'all'];

/**
 * The plans on one shelf, in the order that shelf should read.
 *
 * Upcoming counts up — the next thing first, which is the thing she wants.
 * Everything else counts down, newest first, because looking back you are
 * looking for the most recent.
 */
export const onShelf = (plans = [], shelf = 'upcoming', today = todayLocal()) => {
    const live = plans.filter((p) => !isArchived(p));

    let list;
    if (shelf === 'archived') list = plans.filter(isArchived);
    else if (shelf === 'past') list = live.filter((p) => hasBeen(p, today));
    else if (shelf === 'all') list = [...plans];
    else list = live.filter((p) => !hasBeen(p, today));

    const key = (p) => String(p?.planned_date || '').slice(0, 10);
    return [...list].sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        // Undated plans are ideas, not overdue. They sit at the end of the
        // upcoming list rather than at the top of it as the year 0.
        if (!ka && !kb) return 0;
        if (!ka) return 1;
        if (!kb) return -1;
        return shelf === 'upcoming' ? ka.localeCompare(kb) : kb.localeCompare(ka);
    });
};

/** How many are waiting on each shelf, for the tab labels. */
export const shelfCounts = (plans = [], today = todayLocal()) => ({
    upcoming: onShelf(plans, 'upcoming', today).length,
    past: onShelf(plans, 'past', today).length,
    archived: onShelf(plans, 'archived', today).length,
    all: plans.length,
});
