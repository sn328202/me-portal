import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { GiWorld } from 'react-icons/gi';
import { Button, Modal } from './ui';
import { supabase } from '../lib/supabase';
import { describeSend } from '../utils/planToAtlas';

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
    const ready = Boolean(tripId && target && verdict.items.length);

    const send = async () => {
        if (!ready || busy) return;
        setBusy(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in.');

            const rows = verdict.items.map((i) => ({ ...i, day_id: target.id, user_id: user.id }));
            const { error: insertError } = await supabase.from('atlas_day_items').insert(rows);
            if (insertError) throw insertError;

            // Remembered so the button can say where it went rather than
            // silently doubling the day the second time it is pressed.
            await supabase.from('day_plans')
                .update({ atlas_day_id: target.id, atlas_sent_at: new Date().toISOString() })
                .eq('id', plan_.id);

            setDone({ count: rows.length, date: target.date });
            onSent?.({ dayId: target.id, count: rows.length });
        } catch (err) {
            console.error('Error sending to the Atlas:', err);
            setError('That did not go across. Nothing was added.');
        } finally {
            setBusy(false);
        }
    };

    const close = () => { setOpen(false); setDone(null); setError(null); };

    return (
        <>
            <Button onClick={() => setOpen(true)} title="Put this day into a trip">
                <GiWorld /> Send to a trip
            </Button>

            <Modal open={open} onClose={close} title="Send this day to a trip">
                {done ? (
                    <div className="send-atlas">
                        <p>
                            <strong>{done.count}</strong> {done.count === 1 ? 'thing' : 'things'} added
                            to {pretty(done.date)}.
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

                        {/* Only when the date could not do the work itself. */}
                        {tripId && !verdict.day && days.length > 0 && (
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

                        {tripId && !days.length && (
                            <p className="send-atlas__why">
                                That trip has no days yet — give it a start and end date in the Atlas first.
                            </p>
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
                                {busy ? 'Sending…' : 'Send it'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default SendToAtlas;
