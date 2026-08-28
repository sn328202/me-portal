/**
 * The box a trip happens in.
 *
 * An idea has no date, so it does not belong to one city of a multi-city trip
 * — it belongs to the trip. The first attempt biased the search to a circle
 * around the *centre* of everywhere the trip goes, and for Mumbai → Kerala →
 * Goa that centre is a field near Belagavi with Mumbai six hundred kilometres
 * outside it. "@masque" duly returned mosques in the middle of nowhere.
 *
 * A box around every leg is the honest shape. It contains all three cities,
 * excludes the rest of the world, and — unlike a circle — does not invent a
 * middle that the trip never visits.
 */

/* Padding, in degrees: about fifty kilometres, so a place just outside a city
   limit is still in the box, and a single-city trip has some extent at all. */
const PAD = 0.45;

/**
 * `{ rect: { low, high } }` covering every leg that knows where it is, or
 * null. `low` is the south-west corner, `high` the north-east, which is the
 * order the Places API wants them in.
 */
export const tripRect = (legs = []) => {
    const points = (legs || [])
        // `Number(null)` is 0, and 0 is finite — so a null coordinate sailed
        // straight through this guard and dragged the box out into the
        // Atlantic. Reject the empty ones by hand, and 0,0 with them: it is
        // what an unset pair looks like.
        .filter((l) => l?.lat != null && l?.lng != null
            && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng))
            && !(Number(l.lat) === 0 && Number(l.lng) === 0))
        .map((l) => ({ lat: Number(l.lat), lng: Number(l.lng) }));

    if (!points.length) return null;

    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);

    return {
        rect: {
            low: {
                lat: Math.max(-90, Math.min(...lats) - PAD),
                lng: Math.max(-180, Math.min(...lngs) - PAD),
            },
            high: {
                lat: Math.min(90, Math.max(...lats) + PAD),
                lng: Math.min(180, Math.max(...lngs) + PAD),
            },
        },
    };
};
