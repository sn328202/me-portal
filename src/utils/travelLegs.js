/**
 * Which drives to ask about, and what to do with the answers.
 *
 * The old version asked Google for every gap on every render — and `items` is
 * a new array on every keystroke, so typing a letter into a title fired one
 * Distance Matrix request per gap. Bursts like that hit the per-second quota,
 * come back OVER_QUERY_LIMIT, and the results were then written wholesale:
 *
 *     setTravelTimes(newTravelTimes)   // one failure blanks all of them
 *
 * Which is how the drive times "went away" — not removed, rate-limited and
 * then overwritten with nothing.
 *
 * So: the legs are identified by the two addresses rather than by the items,
 * answers are cached by that pair, and results are merged rather than
 * replacing what is already known.
 */

/** A stable name for one drive, so the same pair is never asked about twice. */
export const legKey = (from, to) => `${String(from || '').trim()}→${String(to || '').trim()}`;

/**
 * The drives between consecutive stops that can actually be looked up.
 *
 * A stop with no address is not a place Google can route to, so the gap either
 * side of it has no answer — which is worth saying rather than silently
 * leaving a blank, because "no drive shown" reads as "the feature is broken".
 */
export const legsOf = (timelineItems = []) => {
    const legs = [];
    for (let i = 0; i < timelineItems.length - 1; i += 1) {
        const a = timelineItems[i];
        const b = timelineItems[i + 1];
        const from = String(a?.location || '').trim();
        const to = String(b?.location || '').trim();
        legs.push({
            id: a.id,
            from,
            to,
            key: from && to ? legKey(from, to) : null,
            // Which end is the reason, so the hint can name it.
            missing: !from ? 'from' : (!to ? 'to' : null),
        });
    }
    return legs;
};

/**
 * A fingerprint of everything the lookup depends on: the addresses, in order.
 *
 * This is what the effect watches. Renaming a stop, changing its cost or
 * dragging a different card about does not change where anything is, and must
 * not cost a request.
 */
export const legsSignature = (timelineItems = []) =>
    timelineItems.map((i) => String(i?.location || '').trim()).join('|');

/** The legs still worth asking about, given what is already known. */
export const unanswered = (legs = [], cache = {}) =>
    legs.filter((l) => l.key && !(l.key in cache));

/** What to show against each item, from the cache. */
export const timesFor = (legs = [], cache = {}) =>
    Object.fromEntries(
        legs.filter((l) => l.key && cache[l.key]).map((l) => [l.id, cache[l.key]])
    );
