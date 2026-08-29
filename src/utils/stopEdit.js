/**
 * Editing one stop, without breaking the others.
 *
 * The timeline draws a block from `start_time` to `end_time`. That means the
 * two are not independent: moving a thing an hour later and leaving its end
 * where it was does not move it, it stretches it. Every edit here is written
 * as the patch that keeps the block the shape it already is unless the shape
 * is the thing being changed.
 */

import { endFrom, durationFrom, readCost } from './dayBuild.js';
import { asTime } from './dayOrder.js';

const DAY = 1440;

/**
 * Move a stop to a new start, taking its length with it.
 *
 * A stop with no end has no length to preserve, so it simply starts later.
 */
export const moveStart = (row, start) => {
    const next = start || null;
    if (!next) return { start_time: null };

    const long = durationFrom(row?.start_time, row?.end_time);
    return {
        start_time: next,
        end_time: long ? endFrom(next, long) : (row?.end_time || null),
    };
};

/** Give it a length, expressed as when it ends. */
export const setLength = (row, duration) => ({
    end_time: duration ? endFrom(row?.start_time, duration) : null,
});

/** How long it currently runs, for the picker. */
export const lengthOfRow = (row) => durationFrom(row?.start_time, row?.end_time);

/** A price, and who is paying it. */
export const setCost = (value) => ({ cost: readCost(value) });

/**
 * Where a block dropped on the grid starts, and how long it runs.
 *
 * Dragging out a new block on the timeline is a statement about both, so the
 * thing that opens for details already knows them and she is not asked twice.
 */
export const fromDrag = (fromHour, toHour) => {
    const a = Math.min(fromHour, toHour);
    const b = Math.max(fromHour, toHour);
    return {
        start_time: asTime(a * 60),
        // A drag of one row is one hour, not none.
        end_time: asTime(Math.min(b + 1, 24) * 60 % DAY),
    };
};

/** A stop is worth keeping only if it is called something. */
export const nameOf = (row) => String(row?.title || '').trim();

/**
 * What the popover should say at the top.
 *
 * A stop with no name yet is the normal state one second after dragging one
 * out, and calling it "Untitled" in a heading reads like a failure rather
 * than an empty box waiting for her.
 */
export const headingFor = (row) => nameOf(row) || 'A new stop';
