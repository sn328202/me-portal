/**
 * The arithmetic behind dragging on the hour grid.
 *
 * All of it is off-by-one country: a drag from the 9am row to the 11am row
 * covers three rows and means 9 until 12, because you are selecting the *hours*
 * and an hour has a far end. Getting that wrong makes every dragged block an
 * hour short, which looks fine and is wrong every time.
 *
 * Kept out of the component so it can be tested without a mouse.
 */

/** 6am to midnight, as the sheet had it. The grid's rows, in order. */
export const HOURS = Array.from({ length: 19 }, (_, i) => i + 6);

/** 9 -> "09:00:00". Postgres `time` wants seconds. */
export const hourToTime = (hour) => {
    const h = Math.max(0, Math.min(24, Math.round(Number(hour))));
    // 24:00 is not a time Postgres will take, and midnight at the end of a day
    // is the start of the next one as far as the clock is concerned.
    return `${String(h % 24).padStart(2, '0')}:00:00`;
};

/** "09:30:00" -> 9. The grid is hourly, so the minutes are not a row. */
export const timeToHour = (time) => {
    if (!time) return null;
    const h = Number(String(time).slice(0, 2));
    return Number.isFinite(h) ? h : null;
};

/**
 * The rows an item occupies: `from` inclusive, `to` exclusive.
 *
 * An item with no end is one row — that is what everything typed in by hand
 * looks like, and pretending it runs until bedtime would be inventing.
 */
export const spanOf = (item) => {
    const raw = timeToHour(item?.start_time);
    if (raw === null) return null;

    // The grid's last row is midnight, and midnight is stored as 00:00. Left
    // as hour 0 it sorts six hours *before* the grid starts and never renders,
    // so anything at midnight belongs at the bottom of the day it was put on.
    const from = raw === 0 ? 24 : raw;

    const rawTo = timeToHour(item?.end_time);
    // Midnight as an end means the end of the day, not six hours before the
    // start; and an end at or before the start is a row of one.
    const to = rawTo === null ? from + 1 : (rawTo === 0 ? 24 : rawTo);
    return { from, to: to > from ? to : from + 1 };
};

/**
 * Where an item sits in the grid, in row terms, clipped to what is drawn.
 *
 * Returns null when the item falls entirely outside the visible hours — a 3am
 * flight is real, but it is not on a grid that starts at six.
 */
export const rowsFor = (item, hours = HOURS) => {
    const span = spanOf(item);
    if (!span) return null;

    const first = hours[0];
    const last = hours[hours.length - 1] + 1;
    const from = Math.max(span.from, first);
    const to = Math.min(span.to, last);
    if (to <= from) return null;

    return { start: from - first, span: to - from };
};

/**
 * The hours a drag covers, from the row it started on to the row it ended on.
 *
 * Dragging upwards is the same selection as dragging downwards — people do
 * both, and refusing one of them reads as a bug.
 */
export const dragRange = (a, b) => {
    const from = Math.min(a, b);
    const to = Math.max(a, b) + 1;
    return { from, to };
};

/** A dragged range as the two fields an item stores. */
export const timesFromDrag = (a, b) => {
    const { from, to } = dragRange(a, b);
    return { start_time: hourToTime(from), end_time: hourToTime(to) };
};

/**
 * Move an item to a new starting hour, keeping how long it is.
 *
 * Dragging a two-hour block to a new time should not quietly make it one hour,
 * and it should not run off the end of the day either.
 */
export const movedTo = (item, hour, hours = HOURS) => {
    const span = spanOf(item);
    const length = span ? span.to - span.from : 1;
    const last = hours[hours.length - 1] + 1;

    const from = Math.max(hours[0], Math.min(hour, last - length));
    return { start_time: hourToTime(from), end_time: hourToTime(from + length) };
};


/**
 * The minutes past the hour, which the grid throws away and the label must not.
 *
 * The grid is hourly, so `timeToHour` truncates — but sixteen of her items are
 * stored at a real time like 19:30, and rounding a 7:30 reservation to "7pm"
 * on the face of the block is telling her something that is not true.
 */
export const timeToMinutes = (time) => {
    if (!time) return null;
    const m = Number(String(time).slice(3, 5));
    return Number.isFinite(m) ? m : 0;
};

/** 9 -> "9am"; (19, 30) -> "7:30pm". */
export const clockLabel = (hour, minute = 0) => {
    if (hour === null || hour === undefined) return '';
    const h = hour % 24;
    const suffix = h < 12 ? 'am' : 'pm';
    const twelve = h % 12 === 0 ? 12 : h % 12;
    const mins = Number(minute) || 0;
    return mins ? `${twelve}:${String(mins).padStart(2, '0')}${suffix}` : `${twelve}${suffix}`;
};

/** 90 -> "1h 30m"; 120 -> "2h"; 45 -> "45m". */
export const lengthLabel = (minutes) => {
    const total = Math.round(Number(minutes) || 0);
    if (total <= 0) return '';
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (!h) return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
};

/**
 * What a block should say about itself: when it starts, when it ends, how long.
 *
 * `length` is null when the item has no end time, and that is most of them —
 * 83 of her 125 are a start and nothing else. A block one row tall is not a
 * one-hour block; it is a block whose length nobody has said. Printing "1h" on
 * it would be inventing, the same way filling in an end time would be, so it
 * prints nothing and the absence is the honest answer.
 */
export const timeLabel = (item) => {
    const fromHour = timeToHour(item?.start_time);
    if (fromHour === null) return null;

    const fromMin = timeToMinutes(item?.start_time);
    const at = clockLabel(fromHour === 0 ? 24 : fromHour, fromMin);

    const toHour = timeToHour(item?.end_time);
    if (toHour === null) return { at, till: null, length: null, range: at };

    const toMin = timeToMinutes(item?.end_time);
    const start = (fromHour === 0 ? 24 : fromHour) * 60 + fromMin;
    const end = (toHour === 0 ? 24 : toHour) * 60 + toMin;
    if (end <= start) return { at, till: null, length: null, range: at };

    const till = clockLabel(toHour === 0 ? 24 : toHour, toMin);
    return { at, till, length: lengthLabel(end - start), range: `${at}\u2013${till}` };
};

/** "9am – 12pm", or just "9am" for something with no length. */
export const describeSpan = (item) => {
    const span = spanOf(item);
    if (!span) return '';
    const label = (h) => {
        const hour = h % 24;
        const suffix = hour < 12 ? 'am' : 'pm';
        const twelve = hour % 12 === 0 ? 12 : hour % 12;
        return `${twelve}${suffix}`;
    };
    return span.to - span.from === 1
        ? label(span.from)
        : `${label(span.from)} – ${label(span.to)}`;
};
