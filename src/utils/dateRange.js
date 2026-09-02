/**
 * A stretch of dates, said the way a person says it.
 *
 * Two `<input type="date">` boxes take a third of the card between them and
 * spend it on slashes and a calendar glyph, to show a fact — "the 4th to the
 * 13th" — that fits in eight characters. So the range is words until she wants
 * to change it, and the boxes come back only then.
 *
 * The year is left off unless the range crosses one. Inside a trip whose own
 * dates are printed at the top of the page, "4 – 13 Sep" is unambiguous and
 * "09/04/2026 – 09/13/2026" is the same fact wearing a uniform.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parts = (value) => {
    const s = String(value ?? '').slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const [, y, mo, d] = m;
    const month = Number(mo) - 1;
    if (month < 0 || month > 11) return null;
    return { year: Number(y), month, day: Number(d) };
};

const one = (p, withYear) => `${p.day} ${MONTHS[p.month]}${withYear ? ` ${p.year}` : ''}`;

/** "4 – 13 Sep", "29 Oct – 2 Nov", "27 Dec 2026 – 2 Jan 2027". */
export const rangeLabel = (from, to) => {
    const a = parts(from);
    const b = parts(to);

    if (!a && !b) return '';
    if (a && !b) return `from ${one(a, false)}`;
    if (!a && b) return `until ${one(b, false)}`;

    const crossesYear = a.year !== b.year;
    if (crossesYear) return `${one(a, true)} – ${one(b, true)}`;

    // Same month: say the month once. "4 – 13 Sep", not "4 Sep – 13 Sep".
    if (a.month === b.month) return `${a.day} – ${b.day} ${MONTHS[a.month]}`;

    return `${one(a, false)} – ${one(b, false)}`;
};
