/**
 * Today, as the date the calendar on the wall says.
 *
 * `new Date().toISOString().slice(0, 10)` is today in UTC, which west of
 * Greenwich is tomorrow for most of the evening. Everything that compares a
 * date against "now" reads it from here.
 *
 * Moved verbatim out of `planShelf` when the Daydream's shelves were retired.
 */

export const todayLocal = (now = new Date()) => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};
