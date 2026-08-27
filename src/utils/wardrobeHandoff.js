/**
 * The Atlas trip, handed to the Wardrobe.
 *
 * The Wardrobe is the standalone outfit planner in /public, embedded in an
 * iframe. It has its own idea of a trip — name, destination, a list of dated
 * events with a dressiness, and a weather table — and until now you typed all
 * of that in a second time, having already told the Atlas the same things.
 *
 * Because both are served from the same origin, the iframe and the app share
 * one localStorage. So the handoff is not an API call or an export: it is
 * writing the trip into `op_trips` under a key derived from the Atlas trip, so
 * sending it twice updates the same trip rather than growing a pile of
 * near-duplicates. Everything the planner has learned about that trip — the
 * outfits you dragged around, the items you unticked — lives under `byProfile`
 * and is carried across untouched.
 *
 * The Atlas weather wins. The planner geocodes the destination once and asks
 * Open-Meteo from the browser; the Atlas geocodes *each day's city* server-side
 * and falls back to ten-year normals beyond the forecast horizon. Goa in
 * December is not Kerala in December, and the packing list is downstream of
 * exactly that difference.
 */

import { legsOn, isHandover } from './tripLegs.js';

const STORE = 'op_trips';

/* The planner's own vocabulary. Indexes into its EVENT_TYPES array — kept here
   as names so a reader can see what the numbers mean, and asserted against the
   planner's list by the tests. */
export const EVENT_TYPES = [
    'Sightseeing / casual', 'Work / meetings', 'Dinner out', 'Party / cocktail',
    'Wedding / formal', 'Outdoor / active', 'Beach / pool', 'Travel day',
    'Athleisure / errands',
];

/** Its dressiness default per type, 1 (casual) to 5 (formal). */
export const TYPE_DRESS = { 0: 1, 1: 3, 2: 3, 3: 4, 4: 5, 5: 1, 6: 1, 7: 1, 8: 1 };

const SIGHTSEEING = 0;
const DINNER = 2;
const OUTDOOR = 5;
const BEACH = 6;
const TRAVEL = 7;

/**
 * What kind of day a planned thing makes.
 *
 * The Atlas knows an item's kind (food, transport, todo) but not how dressed
 * up it is, and dressiness is the one input the outfit suggestions actually
 * turn on. The title is the only other evidence there is, so a small amount of
 * reading it is worth more than defaulting everything to casual and producing
 * the same nine outfits for a beach day and a wedding.
 */
export const eventTypeFor = (item = {}) => {
    const text = String(item.title || '').toLowerCase();

    if (/\b(wedding|reception|sangeet|black tie)\b/.test(text)) return 4;
    if (/\b(party|cocktail|club|nye|new year)\b/.test(text)) return 3;
    if (/\b(beach|pool|swim|snorkel|houseboat|backwater)\b/.test(text)) return BEACH;
    if (/\b(hike|trek|kayak|cycle|bike|climb|safari|walk)\b/.test(text)) return OUTDOOR;
    if (/\b(flight|fly|airport|train|drive|transfer|bus|ferry)\b/.test(text)) return TRAVEL;

    if (item.kind === 'transport') return TRAVEL;
    if (item.kind === 'food') {
        // Breakfast is not dinner out, and dressing for it as if it were is the
        // kind of small wrongness that makes a suggestion feel untrustworthy.
        const hour = Number(String(item.start_time || '').slice(0, 2));
        return Number.isFinite(hour) && hour < 16 ? SIGHTSEEING : DINNER;
    }
    return SIGHTSEEING;
};

const iso = (d) => String(d || '').slice(0, 10);

/* Things people write in a City field that are not cities. */
const NOT_A_PLACE = /^(air ?travel|travel|travel ?day|flight|flying|airplane|plane|in transit|transit|home)$/i;

/**
 * The city that best stands for the trip.
 *
 * The planner geocodes one string, and her first leg is "Air Travel" — which
 * is honest about the day and useless as a location. The leg with the most
 * days in it is the better answer, and a leg named after a mode of transport
 * is not a candidate at all.
 */
export const anchorCity = (legs = []) => {
    const real = legs.filter((l) => l.city && !NOT_A_PLACE.test(String(l.city).trim()));
    if (!real.length) return '';
    return [...real]
        .sort((a, b) => daysBetween(b) - daysBetween(a)
            || iso(a.start_date).localeCompare(iso(b.start_date)))[0].city;
};

const daysBetween = (leg) => {
    const from = new Date(`${iso(leg.start_date)}T12:00:00`);
    const to = new Date(`${iso(leg.end_date)}T12:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
    return Math.round((to - from) / 86400000) + 1;
};

/**
 * The events the planner should show for a day.
 *
 * A day with nothing planned still needs a row, or the packing list has no
 * idea it exists — so it gets one event naming the city, marked as a travel
 * day where you actually change cities.
 */
export const eventsForDay = (day, dayItems = [], legs = []) => {
    const date = iso(day.date);
    const cities = legsOn(legs, date).map((l) => l.city).filter(Boolean);
    const city = cities.join(' → ') || day.city || '';

    const events = dayItems
        .filter((i) => i.title && i.kind !== 'lodging')
        .map((item) => {
            const type = eventTypeFor(item);
            return { name: item.title, date, type, dress: TYPE_DRESS[type] || 2 };
        });

    if (events.length) return events;

    const moving = isHandover(legs, date);
    const type = moving ? TRAVEL : SIGHTSEEING;
    return [{ name: city || 'Free day', date, type, dress: TYPE_DRESS[type] || 2 }];
};

/**
 * The Atlas trip as a planner trip.
 *
 * `existing` is the planner's current copy, if it has one — its `byProfile`
 * carries every outfit and tick you have made and must survive the handoff.
 */
export const wardrobeTrip = (trip, { days = [], items = {}, legs = [], existing = null } = {}) => {
    const ordered = [...days].sort((a, b) => iso(a.date).localeCompare(iso(b.date)));

    const weather = {};
    for (const day of ordered) {
        const w = day.weather;
        if (!w || w.high == null) continue;
        weather[iso(day.date)] = {
            tmax: w.high,
            tmin: w.low ?? w.high,
            pp: 0,
            code: w.code ?? null,
            // The planner draws no distinction, but a ten-year average and a
            // real forecast are not the same promise, so the flag travels.
            estimated: w.source === 'normal',
        };
    }

    const events = ordered.flatMap((day) => eventsForDay(day, items[day.id] || [], legs));

    const home = anchorCity(legs) || ordered.find((d) => d.city)?.city || trip.destination || '';

    return {
        id: `atlas-${trip.id}`,
        name: trip.destination || 'Trip',
        // The planner geocodes this one string, so the leg you spend the most
        // days in is a better answer than "India (Goa / Kerala)".
        dest: home,
        start: iso(trip.start_date),
        end: iso(trip.end_date) || iso(trip.start_date),
        events,
        weather,
        geo: trip.coordinates?.lat != null
            ? { lat: trip.coordinates.lat, lon: trip.coordinates.lng, label: trip.destination || '' }
            : (existing?.geo || null),
        weatherFetched: Object.keys(weather).length ? new Date().toISOString() : undefined,
        // Everything you have done inside the Wardrobe for this trip.
        byProfile: existing?.byProfile || {},
        fromAtlas: true,
    };
};

/**
 * Put it where the Wardrobe will find it.
 *
 * Separated from the building so the shape can be tested without a browser,
 * and so a storage that refuses to be written to (private window, full quota)
 * fails as a returned reason rather than an exception thrown into a click
 * handler.
 */
export const sendToWardrobe = (trip, data, storage) => {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    if (!store) return { ok: false, reason: 'No browser storage here.' };

    let trips = [];
    try {
        trips = JSON.parse(store.getItem(STORE) || '[]');
        if (!Array.isArray(trips)) trips = [];
    } catch {
        // A corrupt store should not cost her the trip she is trying to send.
        trips = [];
    }

    const id = `atlas-${trip.id}`;
    const existing = trips.find((t) => t && t.id === id) || null;
    const built = wardrobeTrip(trip, { ...data, existing });

    const next = existing
        ? trips.map((t) => (t && t.id === id ? built : t))
        : [...trips, built];

    try {
        store.setItem(STORE, JSON.stringify(next));
    } catch {
        return { ok: false, reason: 'Browser storage is full — the Wardrobe keeps its data there.' };
    }

    return {
        ok: true,
        updated: Boolean(existing),
        days: Object.keys(built.weather).length,
        events: built.events.length,
    };
};
