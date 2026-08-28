import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { GiWorld } from 'react-icons/gi';
import { Button, Modal } from './ui';
import { supabase } from '../lib/supabase';
import { describeSend, atlasItemsFrom } from '../utils/planToAtlas';
import { tripSeed, tripName, describeStretch } from '../utils/tripFromPlan';
import '../styles/SendToDay.css';

/**
 * Send a day plan into an Atlas trip, as one of its days.
 *
 * The two halves of the portal describe the same thing at different scales: a
 * day plan is an hour-by-hour Saturday, a trip day is one column of a
 * fortnight. Working a day out here and typing it again over there is the sort
 * of duplication that makes people stop using one of the two.
 *
 * Which day it lands on is not a question — the plan has a date and the trip
 * has a day with that date. The day picker below exists only for the two cases
 * where that fails: a plan with no date yet, and a plan dated outside the trip.
 * Both are ordinary; dreaming a day up before the dates are pinned down is the
 * normal way round.
 */

const pretty = (d) => format(parseISO(String(d).slice(0, 10)), 'EEE d MMM');

const SendToAtlas = ({ plan, items = [], onSent }) => {
    const [open, setOpen] = useState(false);
    const [trips, setTrips] = useState([]);
    const [tripId, setTripId] = useState('');
    const [days, setDays] = useState([]);
    const [chosenDay, setChosenDay] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const [error, setError] = useState(null);
    /* '' means an existing trip; 'new' means start one from this itinerary.
       Hers is the second kind more often than the Atlas assumes. */
    const [mode, setMode] = useState('existing');
    const [newName, setNewName] = useState('');

    useEffect(() => {
        if (!open) return undefined;
        let alive = true;
        supabase.from('atlas_trips')
            .select('id, destination, start_date, end_date')
            .order('start_date', { ascending: false })
            .then(({ data }) => { if (alive) setTrips(data || []); });
        return () => { alive = false; };
    }, [open]);

    useEffect(() => {
        if (!tripId) { setDays([]); return undefined; }
        let alive = true;
        supabase.from('atlas_days')
            .select('id, date')
            .eq('trip_id', tripId)
            .order('date')
            .then(({ data }) => { if (alive) setDays(data || []); });
        return () => { alive = false; };
    }, [tripId]);

    const plan_ = plan || {};
    const verdict = describeSend(plan_, days, items);
    // The matched day if there is one; otherwise whatever she picked instead.
    const target = verdict.day || days.find((d) => d.id === chosenDay) || null;

    const dated = /^\d{4}-\d{2}-\d{2}$/.test(String(plan_.planned_date || '').slice(0, 10));
    const trip = trips.find((t) => String(t.id) === String(tripId)) || null;
    /* When the itinerary's date falls outside the trip, the trip can grow to
       take it. That is how a pile of good days becomes a fortnight — one
       itinerary at a time, which is the way she actually plans. */
    const growth = trip && dated && !verdict.day ? describeStretch(trip, plan_.planned_date) : null;

    const ready = mode === 'new'
        ? Boolean(dated && verdict.items.length && newName.trim())
        : Boolean(tripId && verdict.items.length && (target || growth?.needed));

    /** The day row to land on, making the trip and the day if they are not there. */
    const findDay = async (userId) => {
        const date = String(plan_.planned_date).slice(0, 10);

        if (mode === 'new') {
            const { data: made, error: tripError } = await supabase
                .from('atlas_trips')
                .insert([{ ...tripSeed(plan_), destination: newName.trim(), user_id: userId }])
                .select()
                .single();
            if (tripError) throw tripError;

            const { data: day, error: dayError } = await supabase
                .from('atlas_days')
                .insert([{ trip_id: made.id, user_id: userId, date }])
                .select()
                .single();
            if (dayError) throw dayError;
            return { day, tripId: made.id, made: true };
        }

        if (target) return { day: target, tripId, made: false };

        // Outside the trip's dates. Widen it and fill in the days between, so
        // the new day is not floating on its own at the far end of a gap.
        const { error: growError } = await supabase
            .from('atlas_trips').update(growth.next).eq('id', tripId);
        if (growError) throw growError;

        const { data: added, error: daysError } = await supabase
            .from('atlas_days')
            .insert(growth.added.map((d) => ({ trip_id: tripId, user_id: userId, date: d })))
            .select();
        if (daysError) throw daysError;

        const day = (added || []).find((d) => String(d.date).slice(0, 10) === date);
        if (!day) throw new Error('The day was not created.');
        return { day, tripId, made: false };
    };

    const send = async () => {
        if (!ready || busy) return;
        setBusy(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in.');

            const { day, made } = await findDay(user.id);
            // `verdict.items` is empty when the plan's date is not one of the
            // trip's days, which is exactly the case we have just fixed.
            const sending = verdict.items.length ? verdict.items : atlasItemsFrom(items);

            const rows = sending.map((i) => ({ ...i, day_id: day.id, user_id: user.id }));
            const { error: insertError } = await supabase.from('atlas_day_items').insert(rows);
            if (insertError) throw insertError;

            // Remembered so the button can say where it went rather than
            // silently doubling the day the second time it is pressed.
            await supabase.from('day_plans')
                .update({ atlas_day_id: day.id, atlas_sent_at: new Date().toISOString() })
                .eq('id', plan_.id);

            setDone({ count: rows.length, date: day.date, made });
            onSent?.({ dayId: day.id, count: rows.length });
        } catch (err) {
            console.error('Error sending to the Atlas:', err);
            setError('That did not go across. Nothing was added.');
        } finally {
            setBusy(false);
        }
    };

    const close = () => { setOpen(false); setDone(null); setError(null); };

    // Her own name for it, prefilled from the itinerary, changeable.
    const openDialog = () => { setNewName(tripName(plan_)); setOpen(true); };

    return (
        <>
            <Button onClick={openDialog} title="Put this day into a trip">
                <GiWorld /> Send to a trip
            </Button>

            <Modal open={open} onClose={close} title="Send this day to a trip">
                {done ? (
                    <div className="send-atlas">
                        <p>
                            <strong>{done.count}</strong> {done.count === 1 ? 'thing' : 'things'} added
                            to {pretty(done.date)}
                            {done.made ? ', the first day of a new expedition' : ''}.
                        </p>
                        <p className="send-atlas__note">
                            They are ordinary items on that day now — change them there and this
                            itinerary is not affected, and the other way round.
                        </p>
                        <div className="send-atlas__acts">
                            <Button variant="solid" onClick={close}>Done</Button>
                        </div>
                    </div>
                ) : (
                    <div className="send-atlas">
                        {plan_.atlas_sent_at && (
                            <p className="send-atlas__warn">
                                This itinerary was already sent to a trip
                                on {format(parseISO(plan_.atlas_sent_at.slice(0, 10)), 'd MMM')}.
                                Sending it again adds everything a second time.
                            </p>
                        )}

                        {/* A trip does not always exist before the days do.
                            Hers usually starts as one good Saturday, and the
                            only way to say so was to make an empty expedition
                            and set its dates by hand to cover a day that was
                            already worked out. */}
                        <div className="send-atlas__modes" role="group" aria-label="Where this day goes">
                            <button
                                type="button"
                                className={`send-atlas__mode${mode === 'existing' ? ' is-on' : ''}`}
                                aria-pressed={mode === 'existing'}
                                onClick={() => setMode('existing')}
                            >
                                Into a trip I have
                            </button>
                            <button
                                type="button"
                                className={`send-atlas__mode${mode === 'new' ? ' is-on' : ''}`}
                                aria-pressed={mode === 'new'}
                                onClick={() => setMode('new')}
                            >
                                Start a trip from this
                            </button>
                        </div>

                        {mode === 'new' ? (
                            <>
                                <label className="send-atlas__field">
                                    <span>Call it</span>
                                    <input
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="Where you are going"
                                    />
                                </label>
                                {dated ? (
                                    <p className="send-atlas__matched">
                                        A one-day expedition on <strong>{pretty(plan_.planned_date)}</strong>,
                                        with this itinerary as its first day. Send another itinerary to it
                                        later and it grows to take that day too.
                                    </p>
                                ) : (
                                    <p className="send-atlas__why">
                                        This itinerary has no date yet, and a trip needs one to have days.
                                        Give it a date and this becomes the first day of the trip.
                                    </p>
                                )}
                            </>
                        ) : (
                        <>
                        <label className="send-atlas__field">
                            <span>Which trip</span>
                            <select value={tripId} onChange={(e) => { setTripId(e.target.value); setChosenDay(''); }}>
                                <option value="">Choose a trip…</option>
                                {trips.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.destination}
                                        {t.start_date ? ` — ${pretty(t.start_date)}` : ''}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {tripId && verdict.day && (
                            <p className="send-atlas__matched">
                                Lands on <strong>{pretty(verdict.day.date)}</strong>, matched from this
                                itinerary’s own date.
                            </p>
                        )}

                        {/* Only when the date could not do the work itself.
                            Growing the trip is offered first, because "this
                            day is not in that trip yet" is a thing to fix
                            rather than a thing to work around by filing it on
                            the wrong day. */}
                        {tripId && !verdict.day && growth?.needed && (
                            <p className="send-atlas__matched">
                                {growth.why} Lands on <strong>{pretty(plan_.planned_date)}</strong>.
                            </p>
                        )}

                        {tripId && !verdict.day && !growth?.needed && days.length > 0 && (
                            <>
                                <p className="send-atlas__why">{verdict.why}</p>
                                <label className="send-atlas__field">
                                    <span>Which day</span>
                                    <select value={chosenDay} onChange={(e) => setChosenDay(e.target.value)}>
                                        <option value="">Choose a day…</option>
                                        {days.map((d) => (
                                            <option key={d.id} value={d.id}>{pretty(d.date)}</option>
                                        ))}
                                    </select>
                                </label>
                            </>
                        )}

                        {tripId && !days.length && !growth?.needed && (
                            <p className="send-atlas__why">
                                That trip has no days yet — give it a start and end date in the Atlas first.
                            </p>
                        )}
                        </>
                        )}

                        {verdict.items.length > 0 ? (
                            <p className="send-atlas__count">
                                {verdict.items.length} {verdict.items.length === 1 ? 'thing' : 'things'} to
                                send{verdict.items.some((i) => !i.start_time) ? ', including the ones with no time yet' : ''}.
                            </p>
                        ) : (
                            <p className="send-atlas__why">This itinerary has nothing in it yet.</p>
                        )}

                        {error && <p className="send-atlas__warn">{error}</p>}

                        <div className="send-atlas__acts">
                            <Button onClick={close}>Cancel</Button>
                            <Button variant="solid" disabled={!ready || busy} onClick={send}>
                                {busy
                                    ? 'Sending…'
                                    : mode === 'new'
                                        ? 'Start the trip'
                                        : growth?.needed ? 'Extend the trip and send' : 'Send it'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default SendToAtlas;
