/**
 * Which days a trip covers.
 *
 * Pure, and in its own file because it needed a test: a date input reports
 * every keystroke, so a range built while someone is still typing is a range
 * of days that then has to be cleaned up. A trip ending 6 January ended up
 * with thirty-six days running to the 27th.
 */

const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * A complete 'YYYY-MM-DD'. A date input reports every keystroke, so it hands
 * over half-typed values like '2027-01-0' and '0202-01-06' on the way to the
 * real one — and a range built from those is a range of days that then has to
 * be cleaned up.
 */
const isCompleteDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10));

/** Every date from start to end inclusive, as 'YYYY-MM-DD'. */
export const datesBetween = (start, end) => {
    if (!isCompleteDate(start)) return [];
    if (end && !isCompleteDate(end)) return [];

    const from = new Date(`${String(start).slice(0, 10)}T12:00:00`);
    const to = new Date(`${String(end || start).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return [];

    const out = [];
    const cursor = new Date(from);
    // A guard rather than a while(true): a mistyped end date of 2099 should
    // not try to render thirty thousand day cards.
    while (cursor <= to && out.length < 120) {
        out.push(isoDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return out;
};

