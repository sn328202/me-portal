import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { sendToWardrobe } from '../utils/wardrobeHandoff';
import { wardrobeState, TRIPS_KEY } from '../utils/wardrobeLink';

/**
 * The trip, kept current in the Wardrobe.
 *
 * The Wardrobe is the outfit planner in `/public`, embedded in a same-origin
 * iframe, so its world is this browser's `localStorage`. That makes the link
 * cheap: no endpoint, no round trip, no second copy of the trip in Postgres to
 * keep honest. It also makes it *this browser's* link, which is the one thing
 * worth knowing about it — the Wardrobe itself is backed up to the account
 * (`useWardrobeBackup`), but pushing a trip across happens wherever she
 * happens to have the Atlas open.
 *
 * Reading is `useSyncExternalStore` rather than an effect that copies storage
 * into state, because that is what this is: an external store that changes
 * underneath React. The snapshot is the raw string, which is stable when
 * nothing has been written, so the parse and the counting happen once per
 * actual change rather than once per render.
 *
 * Writing is debounced. The trip page saves as she types, and a rename is half
 * a dozen renders — the Wardrobe should see the finished name, not six
 * versions of it. Every write it *does* see makes the planner reload itself,
 * which is a flicker if she has it open in the next tab.
 */

const SETTLE = 800;

/** Bumped on our own writes, which raise no `storage` event in this window. */
let localVersion = 0;
const listeners = new Set();
const bump = () => { localVersion += 1; listeners.forEach((fn) => fn()); };

const subscribe = (onChange) => {
    listeners.add(onChange);
    const onStorage = (e) => { if (!e.key || e.key === TRIPS_KEY) onChange(); };
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(onChange);
        if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    };
};

const snapshot = () => {
    if (typeof localStorage === 'undefined') return 'none';
    try {
        return `${localVersion}|${localStorage.getItem(TRIPS_KEY) || ''}`;
    } catch {
        return 'none';
    }
};

// The server has no browser storage, and no trips in it.
const serverSnapshot = () => 'none';

const NOTHING = { present: false, events: 0, weatherDays: 0, people: [] };

/**
 * The state, recomputed when the snapshot moves.
 *
 * `snapshot` is taken as an argument rather than read here, because it is the
 * reason this runs at all: the storage is what changed, and passing it in is
 * what says so to the next reader (and to the exhaustive-deps rule, which
 * would otherwise call it a redundant dependency and be wrong).
 */
const read = (store, tripId, snapshotTaken) => (
    tripId == null || snapshotTaken === 'none' ? NOTHING : wardrobeState(store, tripId)
);

export const useWardrobeLink = (trip, data, { auto = true } = {}) => {
    const [error, setError] = useState(null);
    const [sentAt, setSentAt] = useState(null);

    const store = typeof localStorage === 'undefined' ? null : localStorage;
    const tripId = trip?.id ?? null;

    const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
    const state = useMemo(() => read(store, tripId, raw), [store, tripId, raw]);

    /** Push, and report. Returns the result so a button can speak too. */
    const push = useCallback(() => {
        if (!trip || !data) return null;
        const result = sendToWardrobe(trip, data, store);
        if (!result.ok) { setError(result.reason); return result; }
        setError(null);
        // A send that changed nothing is not a send. Saying "sent just now"
        // for it would teach her the timestamp means nothing.
        if (!result.unchanged) { setSentAt(new Date().toISOString()); bump(); }
        return result;
    }, [trip, data, store]);

    /* What the Atlas knows, whenever it changes. The dependency is the shape
       of the trip rather than the objects, because `useTripDays` hands back
       fresh arrays on every load and identity alone would fire this on every
       poll. `sendToWardrobe` compares properly before writing, so a false
       alarm here costs a comparison and nothing else. */
    const fingerprint = !trip ? null : JSON.stringify([
        trip.id, trip.destination, trip.start_date, trip.end_date, trip.coordinates,
        (data?.days || []).map((d) => [
            d.id, d.date, d.city,
            d.weather?.high, d.weather?.low, d.weather?.code, d.weather?.source,
        ]),
        Object.entries(data?.items || {}).map(([id, list]) => [
            id, (list || []).map((i) => [i.id, i.title, i.start_time, i.end_time, i.kind]),
        ]),
        (data?.legs || []).map((l) => [l.id, l.destination, l.start_date, l.end_date]),
    ]);

    const pushRef = useRef(push);
    useEffect(() => { pushRef.current = push; }, [push]);

    // Only ever *update* a trip the Wardrobe already has. Creating one unasked
    // would put every trip she opens into the packing planner, including the
    // eleven she is only reminiscing about.
    const linked = state.present;

    /* `raw` is in here on purpose, alongside the fingerprint.

       The Wardrobe backs itself up to the account, and its rule is timid by
       design: a browser that has never agreed with the server takes the
       server's copy. Which means opening the Wardrobe in a fresh browser
       replaces this browser's `op_trips` with whatever was backed up —
       including an Atlas trip as it stood weeks ago. Watched live: the trip
       page sent fifteen days across, the Wardrobe opened, and the copy from
       August came back over the top of it.

       Pushing again on a fingerprint change would not fix that, because the
       trip did not change — the store did. So the store is a reason to look.
       `sendToWardrobe` compares before writing, so the common case is a
       comparison and nothing else, and a push that does write bumps the
       snapshot to a state it agrees with, which ends there. */
    useEffect(() => {
        if (!auto || tripId == null || !linked) return undefined;
        const timer = setTimeout(() => pushRef.current?.(), SETTLE);
        return () => clearTimeout(timer);
    }, [auto, tripId, linked, fingerprint, raw]);

    return { state, error, sentAt, push };
};
