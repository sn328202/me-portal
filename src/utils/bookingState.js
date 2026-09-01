/**
 * Whether a thing needs booking, and whether it has been.
 *
 * This was a boolean, and "not booked" was quietly doing two opposite jobs: a
 * walk in the park that will never need booking, and a restaurant she has not
 * rung yet. One of those is finished and one is a task, and the card looked
 * identical for both — so the list of things still to do could not be read off
 * the day, which was the entire point of putting it there.
 *
 * Three states, in the order they happen.
 */

export const STATES = [
    {
        id: 'none',
        label: 'no booking',
        title: 'Nothing to book — click if it does need booking',
    },
    {
        id: 'todo',
        label: 'to book',
        title: 'Still needs booking — click when it is held',
    },
    {
        id: 'booked',
        label: '✓ booked',
        title: 'Booked — click if it does not need booking after all',
    },
];

const BY_ID = Object.fromEntries(STATES.map((s) => [s.id, s]));

/**
 * What state a stop is in.
 *
 * A stop pointing at a reservation is booked whatever anything else says: it
 * *is* a booking. Older rows carry the boolean this replaced, so that is read
 * too rather than quietly resetting them to "nothing to book".
 */
export const stateOf = (stop) => {
    if (stop?.booked_id) return 'booked';
    const named = String(stop?.booking || '').trim();
    if (BY_ID[named]) return named;
    return stop?.booked ? 'booked' : 'none';
};

/** Round the loop: nothing to book → to book → booked → nothing to book. */
export const nextState = (state) => {
    const at = STATES.findIndex((s) => s.id === (BY_ID[state] ? state : 'none'));
    return STATES[(at + 1) % STATES.length].id;
};

export const labelOf = (state) => (BY_ID[state] || BY_ID.none).label;
export const titleOf = (state) => (BY_ID[state] || BY_ID.none).title;

/** The one worth a red outline. */
export const needsBooking = (stop) => stateOf(stop) === 'todo';

/** How many things on a day are still to be rung up. */
export const stillToBook = (stops) => (stops || []).filter(needsBooking).length;
