/**
 * A map link, derived rather than stored.
 *
 * An idea has one `url`, and two different things wanted it: the map, and
 * whatever page she actually saved — a menu, a booking form, the winery's
 * own site. Storing the map link there meant attaching a place quietly
 * overwrote the link she cared about.
 *
 * A Google place id is all a map link needs, and `place_id` is already on the
 * row. So the map is worked out when it is drawn and `url` goes back to
 * meaning "the page she saved".
 */

/* The spellings Google actually hands out: google.com/maps, maps.google.com,
   goo.gl/maps from a share sheet, and the country domains of all three. */
const IS_A_MAP = /^https?:\/\/(maps\.google\.[a-z.]+|([a-z0-9-]+\.)?google\.[a-z.]+\/maps|goo\.gl\/maps)/i;

/** The map link for a place, or nothing if there is no place. */
export const mapsLink = (placeId, name = '') => {
    const id = String(placeId || '').trim();
    if (!id) return null;
    const q = String(name || '').trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || id)}&query_place_id=${encodeURIComponent(id)}`;
};

/**
 * The best map link there is for a thing.
 *
 * A place id if it has one; failing that, whatever was stored back when the
 * map link *was* the url — which is most of what already exists.
 */
export const mapFor = (thing, name) => mapsLink(thing?.place_id, name ?? thing?.title ?? thing?.name)
    || (IS_A_MAP.test(String(thing?.url || thing?.link || '')) ? (thing.url || thing.link) : null);

/** A link she saved that is not a map — the menu, the booking page. */
export const pageFor = (thing) => {
    const url = String(thing?.url || '').trim();
    if (!url) return null;
    return IS_A_MAP.test(url) ? null : url;
};
