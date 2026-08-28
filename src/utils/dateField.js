/**
 * When a half-typed date is a date.
 *
 * `<input type="date">` fires change on every keystroke inside a segment. Type
 * 2026 into the year of a date whose month and day are already filled and the
 * browser reports, in order:
 *
 *     0002-09-12
 *     0020-09-12
 *     0202-09-12
 *     2026-09-12
 *
 * Every one of those is a syntactically valid date, and the first three were
 * being written straight to the database. Worse: the input is controlled by
 * what came back, so the moment 0002-09-12 round-tripped it replaced what she
 * was typing and the year could not be finished at all. It reads exactly as
 * she described — it gives up on a long-ago year.
 *
 * The fix is not to debounce. A debounce still writes 0202 if she pauses. The
 * fix is to know that a two-digit year is not a year anyone typed on purpose.
 */

/** The years anyone means. Wide enough for a birthday and a someday trip. */
export const FIRST_YEAR = 1900;
export const LAST_YEAR = 2200;

/**
 * Whether this is a date worth saving, as opposed to one third of a year.
 *
 * Empty is worth saving — clearing a date is a thing people do on purpose.
 */
export const settled = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return true;

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!m) return false;

    const [, y, mo, d] = m.map(Number);
    if (y < FIRST_YEAR || y > LAST_YEAR) return false;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;

    // The 31st of February is well-formed and not a day. Compared in UTC so
    // no timezone can move it into the next month on its own.
    const at = new Date(Date.UTC(y, mo - 1, d));
    return at.getUTCFullYear() === y && at.getUTCMonth() === mo - 1 && at.getUTCDate() === d;
};

/** A stored value as the input wants it: "2026-09-12T00:00:00Z" -> "2026-09-12". */
export const asDate = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
};
