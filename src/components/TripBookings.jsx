import React, { useMemo, useState } from 'react';
import { GiEnvelope } from 'react-icons/gi';
import { Button, Tag } from './ui';
import PasteBooking from './PasteBooking';
import { useReservations } from '../hooks/useReservations';
import { useJourneys } from '../hooks/useJourneys';
import { useGigs } from '../hooks/useGigs';
import { supabase } from '../lib/supabase';
import { fromReservation, fromJourney, fromGig, fromStay, withinTrip } from '../utils/bookingsList';
import { TYPES, placeExisting, placedIds } from '../utils/bookingSave';
import '../styles/Bookings.css';

const fmtDay = (value) => new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
});

/**
 * Everything booked inside this trip's dates, of every kind, while she plans.
 * Paste a confirmation here and it lands on its day without leaving the trip.
 */
const TripBookings = ({ trip, planner }) => {
    const [pasting, setPasting] = useState(false);
    const [busy, setBusy] = useState(null);
    const res = useReservations();
    const jou = useJourneys();
    const gig = useGigs();

    const onDays = useMemo(() => placedIds(planner.items), [planner.items]);

    const rows = useMemo(() => {
        const all = [
            ...res.reservations.filter((r) => r.status === 'booked').map(fromReservation),
            ...jou.journeys.filter((j) => j.status === 'booked').map(fromJourney),
            ...gig.gigs.filter((g) => g.status === 'booked').map(fromGig),
            ...(planner.stays || []).map((s) => fromStay(s, trip.destination)),
        ];
        return withinTrip(all.filter((r) => r.date), trip)
            .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')));
    }, [res.reservations, jou.journeys, gig.gigs, planner.stays, trip]);

    const isOnDay = (r) => (r.type === 'stay' ? true : onDays[r.type]?.has(String(r.id)));

    const putOnDay = async (r) => {
        setBusy(r.key);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await placeExisting(supabase, r.type, r.row, { userId: user.id, trip, days: planner.days });
            await planner.reload();
        } catch (err) {
            console.error(err);
        } finally {
            setBusy(null);
        }
    };

    const afterPaste = () => { res.refresh(); jou.refresh(); gig.refresh(); planner.reload(); };
    const waiting = rows.filter((r) => !isOnDay(r));

    return (
        <section className="trip-bookings">
            <div className="trip-bookings__head">
                <h3 className="section-title">Bookings</h3>
                <Button size="sm" onClick={() => setPasting(true)}><GiEnvelope /> Paste a confirmation</Button>
            </div>
            {rows.length === 0 ? (
                <p className="muted">Nothing booked in these dates yet. Paste a confirmation and it goes straight onto its day.</p>
            ) : (
                <ul className="bookings__all bookings__all--compact">
                    {rows.map((r) => (
                        <li key={r.key} className="bookings__row">
                            <span className="bookings__when">
                                <strong>{fmtDay(r.date)}</strong>
                                {r.time && <span>{r.time}</span>}
                            </span>
                            <span className="bookings__face" aria-hidden="true">{r.face}</span>
                            <span className="bookings__body">
                                <strong>{r.title}</strong>
                                {r.sub && <span className="bookings__meta">{r.sub}</span>}
                            </span>
                            <span className="bookings__tags">
                                <em className={`bookings__type bookings__type--${r.type}`}>{TYPES[r.type]?.label}</em>
                                {isOnDay(r)
                                    ? <Tag>{r.type === 'stay' ? 'Staying' : 'On its day'}</Tag>
                                    : (
                                        <Button size="sm" disabled={busy === r.key} onClick={() => putOnDay(r)}>
                                            {busy === r.key ? 'Adding…' : 'Put on its day'}
                                        </Button>
                                    )}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {waiting.length > 1 && (
                <Button size="sm" onClick={async () => { for (const r of waiting) await putOnDay(r); }}>
                    Put all {waiting.length} on their days
                </Button>
            )}
            <PasteBooking
                open={pasting}
                onClose={() => setPasting(false)}
                trip={trip}
                days={planner.days}
                onSaved={afterPaste}
            />
        </section>
    );
};

export default TripBookings;
