import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { GiCalendar } from 'react-icons/gi';
import { Button, Modal } from './ui';
import { supabase } from '../lib/supabase';
import { localDate, asAtlasItem, asPlanItem, dayOn, bookingNote } from '../utils/reservationToDay';
import '../styles/SendToDay.css';

/**
 * Put a booked table on a day — a trip in the Atlas, or an itinerary in the
 * Daydream.
 *
 * A reservation already knows where, when, how many and the confirmation code
 * you will want at the door. Typing it again into the day it belongs to is the
 * duplication that makes people keep the real plan somewhere else.
 *
 * Which day is not a question: the booking knows when it is. The picker below
 * appears only when the date is not one the trip or itinerary covers.
 */

const pretty = (d) => format(parseISO(String(d).slice(0, 10)), 'EEE d MMM');

const AddBookingToDay = ({ reservation, onPlaced }) => {
    const [open, setOpen] = useState(false);
    const [where, setWhere] = useState('atlas');
    const [trips, setTrips] = useState([]);
    const [plans, setPlans] = useState([]);
    const [tripId, setTripId] = useState('');
    const [days, setDays] = useState([]);
    const [chosen, setChosen] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const [error, setError] = useState(null);

    const on = localDate(reservation?.starts_at);

    useEffect(() => {
        if (!open) return undefined;
        let alive = true;
        Promise.all([
            supabase.from('atlas_trips').select('id, destination, start_date').order('start_date', { ascending: false }),
            supabase.from('day_plans').select('id, title, planned_date').order('planned_date', { ascending: false }),
        ]).then(([t, p]) => {
            if (!alive) return;
            setTrips(t.data || []);
            setPlans(p.data || []);
        });
        return () => { alive = false; };
    }, [open]);

    useEffect(() => {
        if (where !== 'atlas' || !tripId) { setDays([]); return undefined; }
        let alive = true;
        supabase.from('atlas_days').select('id, date').eq('trip_id', tripId).order('date')
            .then(({ data }) => { if (alive) setDays(data || []); });
        return () => { alive = false; };
    }, [where, tripId]);

    /* An itinerary is one day, so the matching is against the plans
       themselves; a trip is many, so it is against that trip's days. */
    const matchedPlan = dayOn(reservation?.starts_at, plans, 'planned_date');
    const matchedDay = dayOn(reservation?.starts_at, days);

    const target = where === 'atlas'
        ? (matchedDay || days.find((d) => d.id === chosen) || null)
        : (matchedPlan || plans.find((p) => p.id === chosen) || null);

    const ready = Boolean(target) && (where !== 'atlas' || Boolean(tripId));

    const place = async () => {
        if (!ready || busy) return;
        setBusy(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in.');

            let label;
            if (where === 'atlas') {
                const { error: e } = await supabase.from('atlas_day_items')
                    .insert([{ ...asAtlasItem(reservation), day_id: target.id, user_id: user.id }]);
                if (e) throw e;
                const trip = trips.find((t) => t.id === tripId);
                label = `${trip?.destination || 'a trip'} — ${pretty(target.date)}`;
            } else {
                const { error: e } = await supabase.from('plan_items')
                    .insert([{
                        ...asPlanItem(reservation),
                        plan_id: target.id,
                        user_id: user.id,
                        spot_id: reservation.spot_id || null,
                    }]);
                if (e) throw e;
                label = target.title || 'an itinerary';
            }

            await supabase.from('reservations')
                .update({ placed_at: new Date().toISOString(), placed_where: label })
                .eq('id', reservation.id);

            setDone(label);
            onPlaced?.(label);
        } catch (err) {
            console.error('Error placing the booking:', err);
            setError('That did not go across. Nothing was added.');
        } finally {
            setBusy(false);
        }
    };

    const close = () => { setOpen(false); setDone(null); setError(null); };

    return (
        <>
            <Button size="sm" onClick={() => setOpen(true)} title="Put this booking on a day">
                <GiCalendar /> Add to a day
            </Button>

            <Modal open={open} onClose={close} title="Put this booking on a day">
                {done ? (
                    <div className="send-atlas">
                        <p><strong>{reservation.restaurant}</strong> is on {done}.</p>
                        <div className="send-atlas__acts">
                            <Button variant="solid" onClick={close}>Done</Button>
                        </div>
                    </div>
                ) : (
                    <div className="send-atlas">
                        {reservation.placed_at && (
                            <p className="send-atlas__warn">
                                Already added to {reservation.placed_where || 'a day'}. Doing it again
                                puts a second one there.
                            </p>
                        )}

                        <p className="send-atlas__count">
                            {reservation.restaurant}
                            {on ? ` · ${pretty(on)}` : ''}
                            {bookingNote(reservation) ? ` · ${bookingNote(reservation)}` : ''}
                        </p>

                        <div className="send-atlas__where" role="group" aria-label="Where to put it">
                            <Button
                                variant={where === 'atlas' ? 'solid' : undefined}
                                onClick={() => { setWhere('atlas'); setChosen(''); }}
                            >
                                A trip
                            </Button>
                            <Button
                                variant={where === 'plan' ? 'solid' : undefined}
                                onClick={() => { setWhere('plan'); setChosen(''); }}
                            >
                                An itinerary
                            </Button>
                        </div>

                        {where === 'atlas' ? (
                            <>
                                <label className="send-atlas__field">
                                    <span>Which trip</span>
                                    <select value={tripId} onChange={(e) => { setTripId(e.target.value); setChosen(''); }}>
                                        <option value="">Choose a trip…</option>
                                        {trips.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.destination}{t.start_date ? ` — ${pretty(t.start_date)}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                {tripId && matchedDay && (
                                    <p className="send-atlas__matched">
                                        Lands on <strong>{pretty(matchedDay.date)}</strong>, matched from the
                                        booking’s own date.
                                    </p>
                                )}

                                {tripId && !matchedDay && days.length > 0 && (
                                    <>
                                        <p className="send-atlas__why">
                                            {on ? `${pretty(on)} is not one of this trip’s days.` : 'This booking has no date.'}
                                        </p>
                                        <label className="send-atlas__field">
                                            <span>Which day</span>
                                            <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
                                                <option value="">Choose a day…</option>
                                                {days.map((d) => (
                                                    <option key={d.id} value={d.id}>{pretty(d.date)}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </>
                                )}

                                {tripId && !days.length && (
                                    <p className="send-atlas__why">
                                        That trip has no days yet — give it dates in the Atlas first.
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                {matchedPlan ? (
                                    <p className="send-atlas__matched">
                                        Lands on <strong>{matchedPlan.title}</strong>, the itinerary for
                                        {' '}{pretty(matchedPlan.planned_date)}.
                                    </p>
                                ) : (
                                    <>
                                        <p className="send-atlas__why">
                                            No itinerary is dated {on ? pretty(on) : 'that day'}.
                                        </p>
                                        <label className="send-atlas__field">
                                            <span>Which itinerary</span>
                                            <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
                                                <option value="">Choose an itinerary…</option>
                                                {plans.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.title}{p.planned_date ? ` — ${pretty(p.planned_date)}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </>
                                )}
                            </>
                        )}

                        {error && <p className="send-atlas__warn">{error}</p>}

                        <div className="send-atlas__acts">
                            <Button onClick={close}>Cancel</Button>
                            <Button variant="solid" disabled={!ready || busy} onClick={place}>
                                {busy ? 'Adding…' : 'Add it'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default AddBookingToDay;
