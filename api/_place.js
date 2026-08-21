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
].join(',');

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
        // Google does not label the neighbourhood separately in this response;
        // the second address component is it often enough to be worth taking.
        neighborhood: (place.formattedAddress || '').split(',')[1]?.trim() || null,
        city: (place.formattedAddress || '').split(',')[2]?.trim()
            || (place.formattedAddress || '').split(',')[1]?.trim() || null,
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

export { toCategory, mapsSearchUrl, PRICE_LEVELS };
