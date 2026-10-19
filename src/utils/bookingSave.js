/**
 * One paste box, four tables.
 *
 * `/api/booking-parse` returns a list of typed items — a table, a journey, a
 * gig or a stay. Everything here turns one of those into the row its own table
 * wants, and works out which day of a trip it lands on. Pure, so it can be
 * tested without a browser; the writes are in `saveBookings` at the bottom.
 */

import { BOOKING, JOURNEY, GIG } from './placeable.js';
import { formFromLeg, journeyFromForm, legSummary } from './journeys.js';
import { formFromParsed, gigFromForm, seatLabel } from './gigs.js';

export const TYPES = {
    table: { label: 'Reservation', face: '🍽️', table: 'reservations', spec: BOOKING },
    journey: { label: 'Travel', face: '✈️', table: 'journeys', spec: JOURNEY },
    gig: { label: 'Gig', face: '🎤', table: 'gigs', spec: GIG },
    stay: { label: 'Hotel', face: '🛏️', table: 'atlas_stays', spec: null },
};

const KIND_FACE = { table: '🍽️', tasting: '🍷', activity: '🎟️', show: '🎭', other: '📌' };
const TRAIN_FACE = { train: '🚆', bus: '🚌', ferry: '⛴️', car: '🚗', other: '🎫' };

export const faceOf = (item) => {
    if (item?.type === 'table') return KIND_FACE[item.kind] || '📌';
    if (item?.type === 'journey') return TRAIN_FACE[item.mode] || '✈️';
    return TYPES[item?.type]?.face || '📌';
};

const nights = (from, to) => Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
);

/** The date an item is on (for a stay, the check-in). */
export const dateOf = (item) => {
    if (item?.type === 'journey') return item.depart_date || null;
    if (item?.type === 'stay') return item.check_in || null;
    return item?.date || null;
};

/** One line for the review list. */
export const summaryOf = (item) => {
    if (item?.type === 'journey') return legSummary(item);
    if (item?.type === 'stay') {
        const n = nights(item.check_in, item.check_out);
        return [item.name, item.city, `${n} night${n === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
    }
    if (item?.type === 'gig') return [item.name, item.venue, seatLabel(item)].filter(Boolean).join(' · ');
    return [item?.name, item?.city, item?.party_size ? `${item.party_size} people` : null].filter(Boolean).join(' · ');
};

/**
 * A table's local date and time as the instant `reservations.starts_at` holds.
 * Built in the browser's zone, which is how the Table Book's own form does it.
 */
const startsAt = (date, time) => new Date(`${date}T${time || '19:00'}`).toISOString();

/** The row for the item's own table. `tripId` only matters for a stay. */
export const rowOf = (item, { tripId = null } = {}) => {
    if (item.type === 'journey') return journeyFromForm(formFromLeg(item));
    if (item.type === 'gig') return gigFromForm(formFromParsed(item));
    if (item.type === 'stay') {
        return {
            trip_id: tripId,
            name: item.name,
            address: item.address || null,
            city: item.city || null,
            check_in: item.check_in,
            check_out: item.check_out,
            cost: item.cost || 0,
            currency: item.currency || null,
            confirmation: item.confirmation || null,
            link: item.link || null,
            notes: item.notes || null,
        };
    }
    return {
        name: item.name,
        kind: item.kind || 'other',
        starts_at: startsAt(item.date, item.time),
        party_size: item.party_size || null,
        seating: item.seating || null,
        city: item.city || null,
        address: item.address || null,
        phone: item.phone || null,
        platform: item.platform || null,
        confirmation: item.confirmation || null,
        notes: item.notes || null,
        status: 'booked',
    };
};

/**
 * The day items a saved booking becomes on a trip, matched to the trip's own
 * days by date. Returns `{ rows, missing }`: the rows to insert, and the
 * dates the trip has no day for, so she can be told rather than left looking.
 */
export const dayRowsFor = (type, saved, days = []) => {
    const spec = TYPES[type]?.spec;
    if (!spec) return { rows: [], missing: [] };
    const byDate = new Map();
    for (const d of days) {
        const key = String(d.date || '').slice(0, 10);
        if (key && !byDate.has(key)) byDate.set(key, d);
    }

    const pieces = spec.spreadOf
        ? spec.spreadOf(saved)
        : [{ ...spec.itemOf(saved), date: spec.dateOf(saved) }];

    const rows = [];
    const missing = [];
    for (const { date, ...item } of pieces) {
        const day = byDate.get(String(date || '').slice(0, 10));
        // The day card keeps the currency the booking was paid in, so the trip's
        // totals convert it instead of reading rupees as dollars.
        const currency = item.cost !== null && item.cost !== undefined ? (saved.currency || null) : null;
        if (day) rows.push({ ...item, currency, day_id: day.id });
        else if (date) missing.push(date);
    }
    return { rows, missing };
};

/** Is a booking's date inside a trip's dates? */
export const inTrip = (date, trip) => {
    const d = String(date || '').slice(0, 10);
    if (!d || !trip?.start_date) return false;
    const end = String(trip.end_date || trip.start_date).slice(0, 10);
    return d >= String(trip.start_date).slice(0, 10) && d <= end;
};

/**
 * Save every item, and — when a trip is given — put each one on its day.
 *
 * `supabase` is passed in so this file stays importable from tests.
 * Returns a short report: how many saved, how many placed, and the names of
 * anything that could not be put on a day because the trip has no day for it.
 */
export const saveBookings = async (supabase, items, { userId, trip = null, days = [] } = {}) => {
    const report = { saved: 0, placed: 0, offTrip: [], failed: [] };
    const tripId = trip?.id ?? null;

    for (const item of items) {
        const type = TYPES[item.type];
        if (!type) continue;
        try {
            const row = {
                ...rowOf(item, { tripId: item.type === 'stay' && inTrip(item.check_in, trip) ? tripId : null }),
                source: 'paste',
                user_id: userId,
            };
            const { data: saved, error } = await supabase.from(type.table).insert([row]).select().single();
            if (error) throw error;
            report.saved += 1;

            if (trip && item.type === 'stay' && !row.trip_id) report.offTrip.push(item.name);
            if (!trip || item.type === 'stay') continue;
            const { rows, missing } = dayRowsFor(item.type, saved, days);
            if (rows.length) {
                const { error: e } = await supabase.from('atlas_day_items')
                    .insert(rows.map((r) => ({ ...r, user_id: userId })));
                if (e) throw e;
                await supabase.from(type.table)
                    .update({ placed_at: new Date().toISOString(), placed_where: trip.destination || 'a trip' })
                    .eq('id', saved.id);
                report.placed += 1;
            }
            if (!rows.length || missing.length) report.offTrip.push(item.name || summaryOf(item));
        } catch (err) {
            console.error('Could not save', item, err);
            report.failed.push(item.name || summaryOf(item));
        }
    }
    return report;
};

/** Put an already-saved booking onto its day of a trip. Returns how many day rows were written. */
export const placeExisting = async (supabase, type, saved, { userId, trip, days = [] }) => {
    const { rows } = dayRowsFor(type, saved, days);
    if (!rows.length) return 0;
    const { error } = await supabase.from('atlas_day_items').insert(rows.map((r) => ({ ...r, user_id: userId })));
    if (error) throw error;
    await supabase.from(TYPES[type].table)
        .update({ placed_at: new Date().toISOString(), placed_where: trip?.destination || 'a trip' })
        .eq('id', saved.id);
    return rows.length;
};

/** Which bookings already have a card on one of these days. */
export const placedIds = (itemsByDay = {}) => {
    const ids = { table: new Set(), journey: new Set(), gig: new Set() };
    for (const list of Object.values(itemsByDay)) {
        for (const it of list || []) {
            if (it.booked_id) ids.table.add(String(it.booked_id));
            if (it.journey_id) ids.journey.add(String(it.journey_id));
            if (it.gig_id) ids.gig.add(String(it.gig_id));
        }
    }
    return ids;
};
