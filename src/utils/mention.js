/**
 * The @-mention that turns a name into a place.
 *
 * Typing "dinner at @masque" and getting a link to the actual restaurant is
 * the thing Google Docs does with @, and it works there because the rules are
 * boring and predictable: the @ starts a word, what follows it is the query,
 * and choosing something replaces exactly those characters and nothing else.
 *
 * The rules are boring here too, and they are here rather than in the
 * component because "which characters did the caret's @ claim" is arithmetic,
 * and arithmetic that is one character out is a feature that eats the space
 * before the word it replaced.
 */

/* A mention can hold a few words — "@marine drive" is a place — but not a
   paragraph. Past this a stray @ has stopped being a mention and is just an
   @ someone typed. */
const MAX_QUERY = 48;

/**
 * The mention the caret is currently inside, or null.
 *
 * Returns the span it covers so a pick can replace precisely that.
 */
export const mentionAt = (text, caret) => {
    const value = String(text ?? '');
    const at = Math.max(0, Math.min(caret ?? value.length, value.length));
    const before = value.slice(0, at);

    const start = before.lastIndexOf('@');
    if (start === -1) return null;

    // The @ has to start a word. Otherwise every email address in a note
    // opens a restaurant menu.
    if (start > 0 && !/\s/.test(before[start - 1])) return null;

    const query = before.slice(start + 1);
    if (query.length > MAX_QUERY) return null;
    // A second @ or a line break ends the old mention rather than extending it.
    if (/[\n@]/.test(query)) return null;

    return { start, end: at, query };
};

/**
 * Swap the mention for the chosen name, and say where the caret should land.
 *
 * A trailing space, because the next thing typed is almost always another
 * word and nobody wants to reach for the space bar after choosing from a menu.
 */
export const replaceMention = (text, token, name) => {
    const value = String(text ?? '');
    if (!token) return { text: value, caret: value.length };

    const chosen = String(name || '').trim();
    const head = value.slice(0, token.start);
    const tail = value.slice(token.end);
    const spaced = tail.startsWith(' ') ? tail : ` ${tail}`;

    return { text: `${head}${chosen}${spaced}`, caret: head.length + chosen.length + 1 };
};

/**
 * How a place reads in a one-line menu.
 *
 * The address is the half that tells two branches of the same chain apart, so
 * it is worth the second line — but the whole formatted address is a postcode
 * and a country nobody is choosing by.
 */
export const placeSubtitle = (place) => {
    const address = String(place?.address || '').trim();
    if (!address) return place?.category || '';
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    // The street and the city; not the postcode, not the country.
    return parts.slice(0, 2).join(', ');
};
