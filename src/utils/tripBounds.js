/**
 * The middle of a trip, and how far it reaches.
 *
 * An idea has no date, so it does not belong to one city of a multi-city trip
 * — it belongs to the trip. Biasing its place search to the anchor city alone
 * put a Mumbai restaurant below every mosque in Kerala, because the anchor is
 * whichever city has the most nights and that is not where the idea is.
 *
 * A centre and a radius covering every leg is the honest answer: it ranks
 * anywhere on the trip above anywhere off it, and prefers nothing within it.
 */

/** Rough kilometres between two points. Good enough to size a circle. */
const spanKm = (a, b) => {
    const dLat = (b.lat - a.lat) * 111;
    // Longitude degrees shrink towards the poles; at the mid-latitude of the
    // pair is close enough for a radius.
    const dLng = (b.lng - a.lng) * 111 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
};

/**
 * `{ lat, lng, radiusKm }` covering every leg that knows where it is, or null.
 *
 * The radius is clamped: Places takes 50km at most, and a one-city trip still
 * wants a city's worth of room rather than a point.
 */
export const tripBounds = (legs = []) => {
    const points = (legs || [])
        // `Number(null)` is 0, and 0 is finite — so a null coordinate passed
        // straight through this filter and dragged the centre of an Indian
        // trip into the Atlantic. Reject the empty ones by hand, and 0,0
        // with them: it is what an unset pair looks like.
        .filter((l) => l?.lat != null && l?.lng != null
            && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng))
            && !(Number(l.lat) === 0 && Number(l.lng) === 0))
        .map((l) => ({ lat: Number(l.lat), lng: Number(l.lng) }));

    if (!points.length) return null;

    const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    const centre = { lat, lng };

    const reach = points.reduce((far, p) => Math.max(far, spanKm(centre, p)), 0);
    return { lat, lng, radiusKm: Math.min(50, Math.max(20, Math.round(reach) + 10)) };
};
