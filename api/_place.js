/**
 * Resolve a spoken place name into a real place.
 *
 * Two backends, in order of quality:
 *
 *   1. Google Places Text Search (New), when GOOGLE_PLACES_API_KEY is set.
 *      Gives rating, price level, hours, phone, website and a photo.
 *      This must be a *separate* key from VITE_GOOGLE_MAPS_API_KEY — that one
 *      is HTTP-referrer restricted for the browser, so a server call with it
 *      is rejected.
 *
 *   2. OpenStreetMap Nominatim otherwise. Free, no key, no signup: address,
 *      neighbourhood, city and coordinates. Enough to be useful on day one.
 *
 * Either way she gets an openable map link, which needs no key at all.
 */

const NOMINATIM_UA = 'MePortal/1.0 (personal dashboard; spot lookup)';

const PLACES_FIELDS = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.rating',
    'places.priceLevel',
    'places.regularOpeningHours',
    'places.websiteUri',
    'places.nationalPhoneNumber',
    'places.primaryTypeDisplayName',
    'places.types',
    'places.googleMapsUri',
    'places.photos',
    'places.addressComponents',
].join(',');

/**
 * Google's formattedAddress is "1234 Valencia St, San Francisco, CA 94110,
 * USA" — so splitting on commas and taking index 2 yields "CA 94110" as the
 * city, which is what the first backfill wrote into 29 rows. addressComponents
 * is typed, so ask for that and read it by meaning rather than by position.
 */
export const addressParts = (components = []) => {
    const find = (...types) => {
        const hit = (components || []).find((c) => (c.types || []).some((t) => types.includes(t)));
        return hit ? (hit.longText || hit.shortText || null) : null;
    };
    return {
        neighborhood: find('neighborhood', 'sublocality_level_1', 'sublocality'),
        city: find('locality', 'postal_town', 'administrative_area_level_2'),
        region: find('administrative_area_level_1'),
        country: find('country'),
    };
};

/** Google's enum -> the 1-4 scale everyone actually recognises. */
const PRICE_LEVELS = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/**
 * The portal's own vocabulary. Google returns a long tail of types
 * ("ramen_restaurant", "art_gallery"); collapse them to something a filter
 * can be built on.
 */
const CATEGORIES = [
    [/restaurant|food|meal_|steak|sushi|ramen|pizza|diner|bakery|dessert|ice_cream/, 'restaurant'],
    [/\bbar\b|pub|brewery|winery|night_club|cocktail/, 'bar'],
    [/cafe|coffee|tea_house/, 'cafe'],
    [/museum|art_gallery|gallery|cultural/, 'museum'],
    [/park|garden|beach|natural_feature|campground/, 'park'],
    [/hiking|trail|mountain|peak/, 'hike'],
    [/store|shop|boutique|market|book/, 'shop'],
    [/theat|cinema|concert|stadium|performing|venue|arena/, 'venue'],
    [/spa|gym|fitness|yoga/, 'wellness'],
    [/hotel|lodging|inn/, 'lodging'],
];

const toCategory = (...hints) => {
    const hay = hints.filter(Boolean).join(' ').toLowerCase();
    for (const [pattern, label] of CATEGORIES) {
        if (pattern.test(hay)) return label;
    }
    return hay ? 'other' : null;
};

const mapsSearchUrl = (query, placeId) => {
    const base = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    return placeId ? `${base}&query_place_id=${encodeURIComponent(placeId)}` : base;
};

/* ---------- Google Places ---------------------------------------------- */

async function viaGoogle(query, key, bias) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': PLACES_FIELDS,
        },
        body: JSON.stringify({ textQuery: query, pageSize: 1, languageCode: 'en', ...bias }),
        signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const place = (await res.json()).places?.[0];
    if (!place) return null;

    const name = place.displayName?.text || query;

    return {
        name,
        category: toCategory(place.primaryTypeDisplayName?.text, (place.types || []).join(' ')),
        address: place.formattedAddress || null,
        ...(({ neighborhood, city }) => ({ neighborhood, city }))(addressParts(place.addressComponents)),
        lat: place.location?.latitude ?? null,
        lng: place.location?.longitude ?? null,
        maps_url: place.googleMapsUri || mapsSearchUrl(name, place.id),
        place_id: place.id || null,
        website: place.websiteUri || null,
        phone: place.nationalPhoneNumber || null,
        rating: typeof place.rating === 'number' ? place.rating : null,
        price_level: PRICE_LEVELS[place.priceLevel] ?? null,
        hours: place.regularOpeningHours?.weekdayDescriptions
            ? { weekday: place.regularOpeningHours.weekdayDescriptions }
            : null,
        // Served through our own endpoint, because the direct media URL needs
        // the API key in the query string and this value is rendered in the
        // browser.
        image_url: place.photos?.[0]?.name
            ? `/api/place-photo?ref=${encodeURIComponent(place.photos[0].name)}`
            : null,
        source: 'google',
    };
}

/* ---------- OpenStreetMap ---------------------------------------------- */

async function viaNominatim(query) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');

    const res = await fetch(url, {
        // Nominatim's usage policy requires an identifying User-Agent and
        // rejects requests without one.
        headers: { 'User-Agent': NOMINATIM_UA, accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`OpenStreetMap ${res.status}`);

    const hit = (await res.json())[0];
    if (!hit) return null;

    const a = hit.address || {};
    const name = hit.name || (hit.display_name || '').split(',')[0] || query;

    return {
        name,
        category: toCategory(hit.type, hit.class),
        address: hit.display_name || null,
        neighborhood: a.neighbourhood || a.suburb || a.quarter || null,
        city: a.city || a.town || a.village || a.municipality || null,
        lat: hit.lat ? Number(hit.lat) : null,
        lng: hit.lon ? Number(hit.lon) : null,
        maps_url: mapsSearchUrl(hit.display_name || name),
        place_id: null,
        website: null,
        phone: null,
        rating: null,
        price_level: null,
        hours: null,
        image_url: null,
        source: 'openstreetmap',
    };
}

/**
 * Resolve `name`, optionally biased toward a city she mentioned.
 * Never throws: an unresolvable place still deserves to be saved, just with
 * her words and nothing else.
 */
export async function resolvePlace(name, { city = null } = {}) {
    const query = [name, city].filter(Boolean).join(' ');
    const key = process.env.GOOGLE_PLACES_API_KEY;

    if (key) {
        try {
            const hit = await viaGoogle(query, key);
            if (hit) return hit;
        } catch (err) {
            // Fall through rather than fail: OpenStreetMap may still know it,
            // and a quota problem should not cost her the spot.
            console.error('Places lookup failed, falling back:', err.message);
        }
    }

    try {
        const hit = await viaNominatim(query);
        if (hit) return hit;
    } catch (err) {
        console.error('OpenStreetMap lookup failed:', err.message);
    }

    return {
        name,
        category: null,
        address: null,
        neighborhood: null,
        city: city || null,
        lat: null,
        lng: null,
        maps_url: mapsSearchUrl(query),
        place_id: null,
        website: null,
        phone: null,
        rating: null,
        price_level: null,
        hours: null,
        image_url: null,
        source: 'unresolved',
    };
}

/**
 * A handful of candidates for a name someone is halfway through typing.
 *
 * `resolvePlace` answers "what is this place" and takes the first hit, which
 * is right when the name is already decided. An @-mention is the other
 * question — "which of these did you mean" — and one result cannot be
 * disagreed with. So: several, cheap fields only, and never an error, because
 * a menu that throws while you are typing is worse than a menu with nothing
 * in it.
 */
const point = (v) => v != null && Number.isFinite(Number(v));

export async function searchPlaces(query, {
    city = null, lat = null, lng = null, radiusKm = 40, rect = null, limit = 6,
} = {}) {
    const text = String(query || '').trim();
    if (text.length < 2) return [];

    const circle = point(lat) && point(lng);
    const box = rect && point(rect.low?.lat) && point(rect.high?.lat);

    /**
     * Where the trip is belongs in the *geography*, not in the query.
     *
     * Appending it turned "@masque" into a search for "masque Kerala", and
     * Google — reasonably — answered with mosques. The city is glued on only
     * when there is no geography to go on at all, where a worse tool beats no
     * tool.
     *
     * A day knows which city it is in, so it gets a *bias*: a soft preference
     * that still allows the day trip an hour away. An idea has no date, so it
     * gets the trip's bounding box as a *restriction* — a circle around the
     * middle of Mumbai → Kerala → Goa is a field near Belagavi with Mumbai
     * six hundred kilometres outside it.
     */
    const full = (circle || box) ? text : [text, city].filter(Boolean).join(' ');

    let where = {};
    if (circle) {
        where = {
            locationBias: {
                circle: {
                    center: { latitude: Number(lat), longitude: Number(lng) },
                    radius: Math.min(50000, Math.max(1000, radiusKm * 1000)),
                },
            },
        };
    } else if (box) {
        where = {
            locationRestriction: {
                rectangle: {
                    low: { latitude: Number(rect.low.lat), longitude: Number(rect.low.lng) },
                    high: { latitude: Number(rect.high.lat), longitude: Number(rect.high.lng) },
                },
            },
        };
    }

    const key = process.env.GOOGLE_PLACES_API_KEY;
    const want = Math.min(10, Math.max(1, limit));

    if (key) {
        try {
            const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': key,
                    // Deliberately short: a menu needs a name, a place to tell
                    // two of them apart, and a link. Every extra field is
                    // billed on every keystroke.
                    'X-Goog-FieldMask': [
                        'places.id', 'places.displayName', 'places.formattedAddress',
                        'places.location', 'places.googleMapsUri', 'places.rating',
                        'places.primaryTypeDisplayName', 'places.types',
                    ].join(','),
                },
                body: JSON.stringify({
                    textQuery: full, pageSize: want, languageCode: 'en', ...where,
                }),
                // A menu is typed at, so the whole call has a budget. Six
                // seconds for Google and four for the fallback fits inside a
                // fifteen-second function with room for a cold start; eight
                // and eight did not, and the pair of them timed the function
                // out rather than returning the worse answer.
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) {
                console.error('place-search: Places', res.status, (await res.text()).slice(0, 300));
            }
            if (res.ok) {
                const hits = ((await res.json()).places || []).map((place) => {
                    const name = place.displayName?.text || text;
                    return {
                        name,
                        address: place.formattedAddress || null,
                        lat: place.location?.latitude ?? null,
                        lng: place.location?.longitude ?? null,
                        maps_url: place.googleMapsUri || mapsSearchUrl(name, place.id),
                        place_id: place.id || null,
                        rating: typeof place.rating === 'number' ? place.rating : null,
                        category: toCategory(
                            place.primaryTypeDisplayName?.text,
                            (place.types || []).join(' ')
                        ),
                        source: 'google',
                    };
                }).filter((p) => p.name);
                if (hits.length) return hits;
            }
        } catch (err) {
            // Fall through: a quota problem should still leave her a menu.
            console.error('place-search: Places threw', err?.name, err?.message);
        }
    }

    try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', full);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('limit', String(want));
        // Nominatim has one geographic control, a viewbox, and it is a
        // preference unless `bounded` is set — which suits both cases here.
        if (circle) {
            const d = Math.min(2, radiusKm / 100);
            url.searchParams.set(
                'viewbox',
                [Number(lng) - d, Number(lat) + d, Number(lng) + d, Number(lat) - d].join(',')
            );
        } else if (box) {
            url.searchParams.set('viewbox', [
                rect.low.lng, rect.high.lat, rect.high.lng, rect.low.lat,
            ].join(','));
        }
        const res = await fetch(url, {
            headers: { 'User-Agent': NOMINATIM_UA, accept: 'application/json' },
            signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) console.error('place-search: OpenStreetMap', res.status);
        if (res.ok) {
            const hits = (await res.json()).map((hit) => {
                const name = hit.name || (hit.display_name || '').split(',')[0] || text;
                return {
                    name,
                    address: hit.display_name || null,
                    lat: hit.lat ? Number(hit.lat) : null,
                    lng: hit.lon ? Number(hit.lon) : null,
                    maps_url: mapsSearchUrl(hit.display_name || name),
                    place_id: null,
                    rating: null,
                    category: toCategory(hit.type, hit.class),
                    source: 'openstreetmap',
                };
            }).filter((p) => p.name);
            if (hits.length) return hits;
        }
    } catch (err) {
        // Fall through to the last resort.
        console.error('place-search: OpenStreetMap threw', err?.name, err?.message);
    }

    // Nothing knew it. A map search for the words she typed is still a link
    // that opens something, which is the whole point of the feature.
    return [{
        name: text,
        address: null,
        lat: null,
        lng: null,
        maps_url: mapsSearchUrl(full),
        place_id: null,
        rating: null,
        category: null,
        source: 'unresolved',
    }];
}

export { toCategory, mapsSearchUrl, PRICE_LEVELS };

/* ---------- geography ---------------------------------------------------- */

/**
 * Great-circle distance in kilometres. Plain trigonometry rather than a
 * dependency: the app needs "is this within a few miles" and "which of these
 * is nearest", both of which the haversine formula answers exactly.
 */
export const distanceKm = (a, b) => {
    if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Turn "Napa" or "Hayes Valley, San Francisco" into a centre and a sensible
 * radius.
 *
 * The radius matters as much as the centre: a neighbourhood is a ten minute
 * walk and a wine region is an hour's drive, so one fixed number is wrong for
 * both. Nominatim returns a bounding box, which is the area the place actually
 * covers — half its diagonal is a far better radius than any constant.
 */
export async function geocodeArea(query) {
    const key = process.env.GOOGLE_PLACES_API_KEY;

    if (key) {
        try {
            const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': key,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.viewport,places.addressComponents',
                },
                body: JSON.stringify({ textQuery: query, pageSize: 1, languageCode: 'en' }),
                signal: AbortSignal.timeout(10000),
            });
            if (res.ok) {
                const place = (await res.json()).places?.[0];
                if (place?.location) {
                    const vp = place.viewport;
                    const radiusKm = vp
                        ? distanceKm(
                            { lat: vp.low.latitude, lng: vp.low.longitude },
                            { lat: vp.high.latitude, lng: vp.high.longitude }
                        ) / 2
                        : null;
                    // The country is read by type rather than by position:
                    // splitting formattedAddress on commas puts the postcode
                    // where the country should be about half the time.
                    const country = (place.addressComponents || [])
                        .find((c) => (c.types || []).includes('country'));
                    return {
                        name: place.displayName?.text || query,
                        address: place.formattedAddress || null,
                        lat: place.location.latitude,
                        lng: place.location.longitude,
                        radiusKm: clampRadius(radiusKm),
                        country: country?.longText || null,
                        countryCode: country?.shortText ? country.shortText.toLowerCase() : null,
                        source: 'google',
                    };
                }
            }
        } catch {
            // Fall through to the free one.
        }
    }

    try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', '1');
        url.searchParams.set('addressdetails', '1');
        const res = await fetch(url, {
            headers: { 'User-Agent': NOMINATIM_UA, accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const hit = (await res.json())[0];
        if (!hit) return null;

        // boundingbox is [south, north, west, east]
        const bb = (hit.boundingbox || []).map(Number);
        const radiusKm = bb.length === 4
            ? distanceKm({ lat: bb[0], lng: bb[2] }, { lat: bb[1], lng: bb[3] }) / 2
            : null;

        return {
            name: (hit.display_name || query).split(',')[0],
            address: hit.display_name || null,
            lat: Number(hit.lat),
            lng: Number(hit.lon),
            radiusKm: clampRadius(radiusKm),
            country: hit.address?.country || null,
            countryCode: hit.address?.country_code
                ? String(hit.address.country_code).toLowerCase()
                : null,
            source: 'openstreetmap',
        };
    } catch {
        return null;
    }
}

/**
 * A bounding box can be absurd — some administrative areas span a whole
 * county, and a single building has almost no extent at all. Keep it between a
 * walkable neighbourhood and a day's driving.
 */
const clampRadius = (km) => {
    if (!km || !Number.isFinite(km)) return 5;
    return Math.min(60, Math.max(1.5, Math.round(km * 10) / 10));
};

/**
 * Geocode a specific street address — used to give a coordinate to places
 * saved before any of this existed.
 *
 * Nominatim's usage policy is one request per second, so callers must space
 * these out. Google has no such limit, which is the practical reason the key
 * is worth having.
 */
export async function geocodeAddress(address) {
    const key = process.env.GOOGLE_PLACES_API_KEY;

    if (key) {
        try {
            const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
            url.searchParams.set('address', address);
            url.searchParams.set('key', key);
            const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (res.ok) {
                const hit = (await res.json()).results?.[0];
                if (hit?.geometry?.location) {
                    return {
                        lat: hit.geometry.location.lat,
                        lng: hit.geometry.location.lng,
                        address: hit.formatted_address || address,
                        source: 'google',
                    };
                }
            }
        } catch { /* fall through */ }
    }

    try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', address);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', '1');
        url.searchParams.set('addressdetails', '1');
        const res = await fetch(url, {
            headers: { 'User-Agent': NOMINATIM_UA, accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const hit = (await res.json())[0];
        if (!hit) return null;
        return {
            lat: Number(hit.lat),
            lng: Number(hit.lon),
            address: hit.display_name || address,
            source: 'openstreetmap',
        };
    } catch {
        return null;
    }
}

/**
 * Full detail for a place we already have Google's id for. This is how the
 * places saved through the old day planner get their coordinates, rating and
 * hours without her re-entering anything.
 */
export async function placeDetails(placeId) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key || !placeId) return null;

    try {
        const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
            headers: {
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask': [
                    'id', 'displayName', 'formattedAddress', 'location', 'rating',
                    'priceLevel', 'regularOpeningHours', 'websiteUri',
                    'nationalPhoneNumber', 'primaryTypeDisplayName', 'types',
                    'googleMapsUri', 'photos', 'addressComponents',
                ].join(','),
            },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const place = await res.json();
        if (!place?.location) return null;

        return {
            name: place.displayName?.text || null,
            category: toCategory(place.primaryTypeDisplayName?.text, (place.types || []).join(' ')),
            address: place.formattedAddress || null,
            ...(({ neighborhood, city }) => ({ neighborhood, city }))(addressParts(place.addressComponents)),
            lat: place.location.latitude,
            lng: place.location.longitude,
            maps_url: place.googleMapsUri || mapsSearchUrl(place.displayName?.text || '', place.id),
            place_id: place.id || placeId,
            website: place.websiteUri || null,
            phone: place.nationalPhoneNumber || null,
            rating: typeof place.rating === 'number' ? place.rating : null,
            price_level: PRICE_LEVELS[place.priceLevel] ?? null,
            hours: place.regularOpeningHours?.weekdayDescriptions
                ? { weekday: place.regularOpeningHours.weekdayDescriptions }
                : null,
            image_url: place.photos?.[0]?.name
                ? `/api/place-photo?ref=${encodeURIComponent(place.photos[0].name)}`
                : null,
            source: 'google',
        };
    } catch {
        return null;
    }
}

/**
 * Places near a point that she has *not* already saved — the "add more" half
 * of planning a day somewhere. Google only; there is no free equivalent worth
 * showing.
 */
export async function nearbyPlaces({ lat, lng, radiusKm = 3, keyword = null, limit = 12 }) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key || lat == null || lng == null) return [];

    try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask': PLACES_FIELDS,
            },
            body: JSON.stringify({
                textQuery: keyword || 'things to do',
                pageSize: Math.min(20, limit),
                languageCode: 'en',
                locationBias: {
                    circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(50000, radiusKm * 1000) },
                },
            }),
            signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) return [];

        return ((await res.json()).places || []).map((place) => ({
            name: place.displayName?.text || null,
            category: toCategory(place.primaryTypeDisplayName?.text, (place.types || []).join(' ')),
            address: place.formattedAddress || null,
            lat: place.location?.latitude ?? null,
            lng: place.location?.longitude ?? null,
            place_id: place.id || null,
            maps_url: place.googleMapsUri || null,
            rating: typeof place.rating === 'number' ? place.rating : null,
            price_level: PRICE_LEVELS[place.priceLevel] ?? null,
            image_url: place.photos?.[0]?.name
                ? `/api/place-photo?ref=${encodeURIComponent(place.photos[0].name)}`
                : null,
        })).filter((p) => p.name && p.lat != null);
    } catch {
        return [];
    }
}

/**
 * Order stops so the day does not criss-cross.
 *
 * Nearest-neighbour from the most north-westerly point, then a couple of
 * 2-opt passes to undo the crossings greedy ordering always leaves. For the
 * handful of stops in a real day this is effectively optimal, and it is
 * deterministic — the same set always produces the same route, which matters
 * more than the last few percent of efficiency.
 */
export function routeOrder(stops) {
    const points = stops.filter((s) => s.lat != null && s.lng != null);
    const unplaceable = stops.filter((s) => s.lat == null || s.lng == null);
    if (points.length < 3) return [...points, ...unplaceable];

    let start = 0;
    points.forEach((p, i) => {
        if (p.lat > points[start].lat || (p.lat === points[start].lat && p.lng < points[start].lng)) start = i;
    });

    const remaining = points.map((_, i) => i).filter((i) => i !== start);
    const order = [start];
    while (remaining.length) {
        const last = points[order[order.length - 1]];
        let best = 0;
        let bestDist = Infinity;
        remaining.forEach((idx, j) => {
            const d = distanceKm(last, points[idx]);
            if (d != null && d < bestDist) { bestDist = d; best = j; }
        });
        order.push(remaining.splice(best, 1)[0]);
    }

    const legLength = (route) => route.slice(1).reduce(
        (sum, idx, i) => sum + (distanceKm(points[route[i]], points[idx]) || 0), 0
    );

    let route = order;
    for (let pass = 0; pass < 2; pass += 1) {
        for (let i = 1; i < route.length - 1; i += 1) {
            for (let j = i + 1; j < route.length; j += 1) {
                const candidate = [
                    ...route.slice(0, i),
                    ...route.slice(i, j + 1).reverse(),
                    ...route.slice(j + 1),
                ];
                if (legLength(candidate) < legLength(route)) route = candidate;
            }
        }
    }

    // Anything without coordinates goes at the end rather than being dropped.
    return [...route.map((i) => points[i]), ...unplaceable];
}
