/**
 * Every kind of booking in one list, for the "All" view of the Bookings room
 * and for a trip's Bookings panel. Each table keeps its own shape; this only
 * reads them into one common row so they can be sorted together.
 */

import { localDate as resDate } from './reservationToDay.js';
import { faceOf as kindFace } from './bookingKinds.js';
import { faceOf as modeFace, routeLabel, serviceLabel, clockLabel, localDate as wallDate } from './journeys.js';
import { placeLabel, seatLabel } from './gigs.js';

const resTime = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null
        : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const shortDay = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00`)
    .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const fromReservation = (r) => ({
    key: `table-${r.id}`, type: 'table', id: r.id, row: r,
    date: resDate(r.starts_at), time: resTime(r.starts_at),
    face: kindFace(r), title: r.name || 'Reservation',
    sub: [r.city, r.party_size ? `${r.party_size} people` : null].filter(Boolean).join(' · '),
    placed: r.placed_where || null, live: r.status === 'booked',
});

export const fromJourney = (j) => ({
    key: `journey-${j.id}`, type: 'journey', id: j.id, row: j,
    date: wallDate(j.departs), time: clockLabel(j.departs),
    face: modeFace(j), title: routeLabel(j) || serviceLabel(j) || 'Journey',
    sub: [serviceLabel(j), j.arrives ? `lands ${clockLabel(j.arrives)}` : null].filter(Boolean).join(' · '),
    placed: j.placed_where || null, live: j.status === 'booked',
});

export const fromGig = (g) => ({
    key: `gig-${g.id}`, type: 'gig', id: g.id, row: g,
    date: wallDate(g.starts), time: clockLabel(g.starts),
    face: '🎤', title: g.name,
    sub: [placeLabel(g), seatLabel(g)].filter(Boolean).join(' · '),
    placed: g.placed_where || null, live: g.status === 'booked',
});

export const fromStay = (s, tripName = null) => ({
    key: `stay-${s.id}`, type: 'stay', id: s.id, row: s,
    date: s.check_in, until: s.check_out, time: null,
    face: '🛏️', title: s.name,
    sub: [s.city, `until ${shortDay(s.check_out)}`].filter(Boolean).join(' · '),
    placed: s.trip_id ? (tripName || 'a trip') : null, live: true,
});

/** Upcoming first by date; stays count as upcoming until check-out. */
export const mergeUpcoming = ({ reservations = [], journeys = [], gigs = [], stays = [] }, today, tripNames = {}) => {
    const rows = [
        ...reservations.map(fromReservation),
        ...journeys.map(fromJourney),
        ...gigs.map(fromGig),
        ...stays.map((s) => fromStay(s, tripNames[s.trip_id])),
    ].filter((r) => r.live && r.date && (r.until || r.date) >= today);
    return rows.sort((a, b) => (a.date === b.date
        ? String(a.time || '').localeCompare(String(b.time || ''))
        : a.date.localeCompare(b.date)));
};

/** The bookings whose date falls inside a trip (a stay: whose nights overlap it). */
export const withinTrip = (rows, trip) => {
    const start = String(trip?.start_date || '').slice(0, 10);
    const end = String(trip?.end_date || trip?.start_date || '').slice(0, 10);
    if (!start) return [];
    return rows.filter((r) => (r.type === 'stay'
        ? r.date <= end && r.until > start
        : r.date >= start && r.date <= end));
};
