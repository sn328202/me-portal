/**
 * What kind of thing is booked.
 *
 * The Table Book was restaurant-shaped: one column called `restaurant`, one
 * platform list of booking sites, one implicit assumption that a booking is a
 * table. But a wine tasting, a paragliding slot, a museum ticket and a train
 * are all the same shape — a name, a time, a confirmation, something you can
 * lose by not turning up — and every one of them was being written into an
 * itinerary by hand instead.
 *
 * Seven kinds, not seventy. This is a picker, not a taxonomy, and the only
 * job the kind has is to let her find the thing and know at a glance what it
 * is.
 */

export const KINDS = [
    { id: 'table', label: 'Table', face: '🍽️' },
    { id: 'tasting', label: 'Tasting', face: '🍷' },
    { id: 'activity', label: 'Activity', face: '🎟️' },
    { id: 'show', label: 'Show', face: '🎭' },
    { id: 'transport', label: 'Travel', face: '🚆' },
    { id: 'stay', label: 'Stay', face: '🛏️' },
    { id: 'other', label: 'Other', face: '📌' },
];

const BY_ID = Object.fromEntries(KINDS.map((k) => [k.id, k]));

/** The kind of a booking, defaulting to the one everything used to be. */
export const kindOf = (booking) => {
    const id = String(booking?.kind || '').trim();
    return BY_ID[id] ? id : 'table';
};

export const faceOf = (booking) => BY_ID[kindOf(booking)].face;
export const labelOf = (booking) => BY_ID[kindOf(booking)].label;

/**
 * A guess from what she called it.
 *
 * Used when a confirmation is parsed, where the sender knows what it sold her
 * but the shape of the email does not say.
 *
 * Note the fallback is 'other', not 'table'. `kindOf` defaults to a table
 * because every one of the 78 bookings that existed before this was one; a
 * *guess* with nothing to go on is a different claim, and "I do not know" is
 * the true one. "Hamilton at the Orpheum" is not a restaurant, and saying so
 * confidently would be worse than shrugging.
 */
const HINTS = [
    [/\b(tasting|winery|vineyard|cellar|brewery|distiller)/i, 'tasting'],
    [/\b(theatre|theater|concert|show|gig|opera|ballet|cinema|match|game)\b/i, 'show'],
    /* `train\b` without a leading boundary, because the confirmation says
       "Caltrain" and "Eurostar service", not "train". The trailing boundary
       keeps "training" out. */
    [/\b(flight|rail|ferry|bus|transfer|car hire|rental car)\b|train\b/i, 'transport'],
    [/\b(hotel|hostel|airbnb|inn|lodge|resort|stay|night[s]?)\b/i, 'stay'],
    [/\b(tour|workshop|class|museum|gallery|spa|massage|paraglid|dive|kayak|climb|ticket)\b/i, 'activity'],
    [/\b(dinner|lunch|brunch|breakfast|table|restaurant|omakase|bar)\b/i, 'table'],
];

export const guessKind = (text) => {
    const said = String(text || '');
    for (const [pattern, kind] of HINTS) if (pattern.test(said)) return kind;
    return 'other';
};

/** How the count reads in a heading. */
export const countBy = (bookings) => {
    const out = {};
    (bookings || []).forEach((b) => {
        const k = kindOf(b);
        out[k] = (out[k] || 0) + 1;
    });
    return out;
};
