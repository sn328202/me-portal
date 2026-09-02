/**
 * Keeping the Wardrobe's copy of a trip current.
 *
 * The handoff already existed, as a button in the trip's setup drawer that
 * copied the trip across once. That is the shape of an export, and an export
 * is wrong here: the days move. She adds a wedding on the Thursday, presses
 * *Fill in weather*, drops a day at the end — and the Wardrobe is still packing
 * for the trip as it stood the last time she happened to find the button.
 * Worse, it looks right, because a stale copy is indistinguishable from a
 * fresh one until you read it.
 *
 * So the Atlas keeps its half current instead of offering to. What the Atlas
 * owns — the name, the destination, the dates, the events, the weather — is
 * rewritten whenever it changes. What the Wardrobe owns — every outfit
 * dragged, every packing item ticked, all of it under `byProfile` — is never
 * touched. The two halves are the whole point: the line between them is
 * `atlasPart`, and it is the only thing compared.
 *
 * Nothing here touches the browser. The comparison and the reading are pure
 * so they can be tested without an iframe, a storage or a render.
 */

/** The planner's storage keys. It prefixes everything with `op_`. */
export const TRIPS_KEY = 'op_trips';
export const PROFILES_KEY = 'op_profiles';

/** The Atlas trip N, as the Wardrobe names it. */
export const wardrobeIdFor = (tripId) => `atlas-${tripId}`;

/** And back, for the link home. Null for a trip the Wardrobe made itself. */
export const atlasIdFrom = (wardrobeId) => {
    const m = /^atlas-(.+)$/.exec(String(wardrobeId || ''));
    return m ? m[1] : null;
};

/**
 * The half of a planner trip the Atlas is responsible for.
 *
 * Everything else is deliberately absent. `byProfile` is hers. `weatherFetched`
 * is a timestamp that changes on every build and would make every trip look
 * changed forever, which is the difference between "keeps itself current" and
 * "writes to storage twice a second".
 */
export const atlasPart = (trip) => {
    if (!trip) return null;
    return {
        name: trip.name ?? null,
        dest: trip.dest ?? null,
        start: trip.start ?? null,
        end: trip.end ?? null,
        events: trip.events || [],
        weather: trip.weather || {},
        geo: trip.geo || null,
    };
};

/**
 * Stable stringify: key order must not decide whether a trip looks changed.
 * `JSON.stringify` walks objects in insertion order, and `weather` is built by
 * iterating days, so a day inserted in the middle would reorder the whole map
 * and read as a change to every date in it.
 */
const stable = (value) => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value === undefined ? null : value);
};

/** Does the Wardrobe's copy still say what the Atlas says? */
export const sameAtlasPart = (a, b) => stable(atlasPart(a)) === stable(atlasPart(b));

/** Read the planner's trips out of a storage, forgivingly. */
export const readTrips = (storage) => {
    if (!storage) return [];
    try {
        const parsed = JSON.parse(storage.getItem(TRIPS_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
        // A corrupt store is a reason to say "nothing there", not to throw
        // into whatever render happened to be reading.
        return [];
    }
};

const readProfiles = (storage) => {
    if (!storage) return [];
    try {
        const parsed = JSON.parse(storage.getItem(PROFILES_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
        return [];
    }
};

const countTrue = (map) => Object.values(map || {}).filter(Boolean).length;

/**
 * What the Wardrobe has actually done with this trip.
 *
 * Reported per person rather than added up, because two people packing for the
 * same fortnight is two jobs and a combined "18 of 30 days dressed" describes
 * neither of them. A profile the Wardrobe has never opened for this trip is
 * left out — a row of zeroes is not information.
 */
export const wardrobeState = (storage, tripId) => {
    const id = wardrobeIdFor(tripId);
    const trip = readTrips(storage).find((t) => t.id === id) || null;
    if (!trip) return { present: false, events: 0, weatherDays: 0, people: [] };

    const names = Object.fromEntries(readProfiles(storage).map((p) => [p.id, p.name || 'Someone']));

    const people = Object.entries(trip.byProfile || {})
        .map(([pid, work]) => ({
            id: pid,
            name: names[pid] || 'Someone',
            dressed: countTrue(work?.dayDone),
            packed: countTrue(work?.packChecked),
            outfits: (work?.customOutfits || []).length,
        }))
        .filter((p) => p.dressed || p.packed || p.outfits);

    return {
        present: true,
        events: (trip.events || []).length,
        weatherDays: Object.keys(trip.weather || {}).length,
        people,
    };
};
