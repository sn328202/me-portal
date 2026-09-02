/**
 * Which city a place is in.
 *
 * "It should show the city that that lodging is in as a feature of that
 * lodging" — and Google already knows. A geocode result carries the place
 * broken into its administrative pieces, so the city does not have to be
 * guessed by slicing up a formatted address string, which is the approach
 * that works until you book somewhere in a country that writes its addresses
 * in a different order.
 *
 * The preference order is smallest-thing-a-person-would-say-first. A hotel in
 * San Francisco is in San Francisco (`locality`). A resort in Kumarakom is in
 * Kumarakom, and if Google has no locality for it — which happens for places
 * out in the backwaters — then Kerala is a better answer than nothing.
 */

const PREFER = [
    'locality',
    'postal_town',
    'sublocality_level_1',
    'administrative_area_level_3',
    'administrative_area_level_2',
    'administrative_area_level_1',
];

/** The city out of a geocode result's address_components. */
export const cityOf = (components = []) => {
    if (!Array.isArray(components)) return '';
    for (const want of PREFER) {
        const hit = components.find((c) => Array.isArray(c?.types) && c.types.includes(want));
        const name = String(hit?.long_name || '').trim();
        if (name) return name;
    }
    return '';
};

/**
 * The city, falling back to reading the address.
 *
 * When there are no components to read — an older saved row, a hand-typed
 * address — the second-to-last comma-separated piece is usually the city, or
 * the piece before the postcode. It is a guess and it is labelled as one by
 * being last in line.
 */
export const cityFrom = (place) => {
    const known = cityOf(place?.components);
    if (known) return known;

    const parts = String(place?.address || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (parts.length < 3) return '';

    // ..., <city>, <region + postcode>, <country>
    const guess = parts[parts.length - 3];
    return /^\d/.test(guess) ? '' : guess;
};
