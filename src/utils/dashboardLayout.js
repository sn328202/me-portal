/**
 * What is on the dashboard, in what order, at what width.
 *
 * Both used to be decided elsewhere and neither was hers. The order was the
 * order of the JSX; the width was a `span` prop hardcoded inside each widget,
 * which is why almost everything asked for two of the three columns and the
 * grid came out lumpy — and why a trip countdown four lines tall was stretched
 * to the height of whatever long list happened to sit beside it.
 *
 * Now both live in her settings and this decides them, so a widget no longer
 * has an opinion about how much of the page it deserves.
 */

/** How wide each one wants to be when she has not said otherwise. */
export const DEFAULT_SPANS = {
    today: 2,      // three lists side by side
    tobook: 2,     // a date, a name and a place on one line
    captures: 2,   // long URLs, and the reply under each
    calendar: 2,   // an agenda reads badly in a narrow column
    library: 3,    // a strip of covers wants the width
    chores: 1,     // room, then a short list
    travel: 1,     // a countdown and a name
};

export const SPANS = [1, 2, 3];

/** Clamped, because a saved 7 from a future version should not break a grid. */
export const spanOf = (id, saved = {}) => {
    const want = Number(saved?.[id] ?? DEFAULT_SPANS[id] ?? 1);
    if (!SPANS.includes(want)) return DEFAULT_SPANS[id] || 1;
    return want;
};

/** 1 → 2 → 3 → 1, for a control that cycles rather than opening a menu. */
export const nextSpan = (span) => (SPANS.includes(span) ? SPANS[(SPANS.indexOf(span) + 1) % SPANS.length] : 1);

/**
 * The widgets to draw, in her order.
 *
 * A saved order is a list of ids and nothing else, so it goes stale in both
 * directions: it can name a widget that has since been deleted, and it can be
 * missing one that has since been written. Ids nothing matches are dropped;
 * anything new goes to the end, where it is visible without displacing what
 * she arranged.
 */
export const orderedWidgets = (enabled = [], order = []) => {
    const live = new Set(enabled);
    const seen = new Set();
    const out = [];

    for (const id of Array.isArray(order) ? order : []) {
        if (live.has(id) && !seen.has(id)) { out.push(id); seen.add(id); }
    }
    for (const id of enabled) {
        if (!seen.has(id)) { out.push(id); seen.add(id); }
    }
    return out;
};

/**
 * One card moved, as a new order.
 *
 * Takes the ids rather than the indices: the list being dragged is the
 * *visible* one, and reading positions out of it would be wrong the moment a
 * widget is turned off.
 */
export const moveWidget = (order = [], activeId, overId) => {
    if (!activeId || !overId || activeId === overId) return order;
    const from = order.indexOf(activeId);
    const to = order.indexOf(overId);
    if (from === -1 || to === -1) return order;

    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, activeId);
    return next;
};
