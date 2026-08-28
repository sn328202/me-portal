/**
 * Is this Google result the restaurant she meant?
 *
 * Filling in a hundred old bookings by taking the first search result each
 * time would put the wrong address on some of them, and a booking with a
 * confidently wrong address is worse than one with none — she would drive to
 * it. So the sweep only accepts a result whose name it can defend, and leaves
 * the rest alone to be linked by hand.
 *
 * The comparison is deliberately generous about the noise restaurant names
 * carry — "The", "Restaurant", "& Bar", accents, punctuation, an outlet name
 * after a comma — and strict about everything else.
 */

/* Words that carry no identity. "Bombay Canteen" and "The Bombay Canteen" are
   the same place; "Bar" and "Bombay Canteen" are not. */
const NOISE = new Set([
    'the', 'a', 'an', 'and', 'at', 'of', 'de', 'la', 'le', 'el',
    'restaurant', 'restaurante', 'cafe', 'café', 'bar', 'kitchen', 'bistro',
    'brasserie', 'trattoria', 'osteria', 'ristorante', 'grill', 'house',
    'co', 'company', 'ltd', 'inc', 'pvt',
]);

/** A name reduced to the words that identify it. */
export const words = (name) =>
    String(name || '')
        .normalize('NFD')
        // Strip accents, so "Café Léon" and "Cafe Leon" are one place.
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        // Anything after a comma is usually a branch or a street.
        .split(',')[0]
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w && !NOISE.has(w));

/**
 * Whether two names are the same restaurant, as far as anything can tell
 * without asking.
 *
 * The identifying words have to match exactly — with one allowance, which is
 * that Google routinely appends the city ("Masque" is listed as "Masque
 * Mumbai"). Anything else extra means a different place: "Indigo" and
 * "Indigo Deli" are two restaurants, and a subset test would have quietly
 * merged them.
 *
 * `city` is the reservation's own city, so the allowance only applies where
 * she has already said where the table is.
 */
export const looksLike = (a, b, city = '') => {
    const one = words(a);
    const two = words(b);
    if (!one.length || !two.length) return false;

    const [short, long] = one.length <= two.length ? [one, two] : [two, one];
    const held = new Set(short);
    if (!short.every((w) => long.includes(w))) return false;

    // Everything the longer name has that the shorter does not must be the
    // city, or this is a different restaurant with a similar name.
    const place = new Set(words(city));
    return long.filter((w) => !held.has(w)).every((w) => place.has(w));
};

/**
 * The fields worth copying off a resolved place.
 *
 * Only ever fills gaps: anything she typed herself outranks anything Google
 * says, because she was there and it was not.
 */
export const fillFrom = (reservation, place) => {
    const patch = {};
    const take = (key, value) => {
        if (value === null || value === undefined || value === '') return;
        const held = reservation?.[key];
        if (held === null || held === undefined || held === '') patch[key] = value;
    };

    take('place_id', place?.place_id);
    take('address', place?.address);
    take('maps_url', place?.maps_url);
    take('website', place?.website);
    take('phone', place?.phone);
    take('city', place?.city);
    if (reservation?.rating === null || reservation?.rating === undefined) {
        if (Number.isFinite(Number(place?.rating))) patch.rating = Number(place.rating);
    }
    return patch;
};
