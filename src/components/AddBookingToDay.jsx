import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { GiCalendar } from 'react-icons/gi';
import { Button, Modal } from './ui';
import { supabase } from '../lib/supabase';
import { localDate, asAtlasItem, bookingNote } from '../utils/reservationToDay';
import { dayChoices, daysOn, labelDay, nearestDays } from '../utils/bookingDay';
import '../styles/SendToDay.css';

/**
 * Put a booking on a day.
 *
 * This used to ask two questions before it could look for anything: "a trip or
 * an itinerary?", then "which trip?". Both made sense when the Daydream and
 * the Atlas were separate rooms. They stopped making sense when a day became a
 * one-day trip — a day plan added to the Atlas now *is* a trip, so choosing
 * "An itinerary" searched the old room and found nothing, which is exactly
 * what it looks like when a feature is broken.
 *
 * One question now, and usually it answers itself: a booking knows its date,
 * so the day it lands on is the day with that date. Every day of every trip is
 * in one list, so nothing has to be found twice.
 */

const pretty = (d) => format(parseISO(String(d).slice(0, 10)), 'EEE d MMM');

const AddBookingToDay = ({ reservation, onPlaced }) => {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [chosen, setChosen] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const [error, setError] = useState(null);

    const on = localDate(reservation?.starts_at);

    useEffect(() => {
        if (!open) return undefined;
        let alive = true;
        setLoading(true);
        supabase
            .from('atlas_days')
            .select('id, date, city, trip_id, atlas_trips(id, destination)')
            .order('date')
            .then(({ data, error: err }) => {
                if (!alive) return;
                if (err) setError('Could not read your trips.');
                setRows(data || []);
                setLoading(false);
            });
        return () => { alive = false; };
    }, [open]);

    const choices = useMemo(() => dayChoices(rows), [rows]);
    const matches = useMemo(() => daysOn(choices, on), [choices, on]);
    const near = useMemo(() => nearestDays(choices, on), [choices, on]);

    /* One match is the answer. Two trips can cover the same date — a weekend
       inside a longer trip — and then she has to say which, rather than the
       first one silently winning. */
    const settled = matches.length === 1 ? matches[0] : null;
    const target = settled || choices.find((d) => String(d.id) === String(chosen)) || null;

    const place = async () => {
        if (!target || busy) return;
        setBusy(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in.');

            const { error: e } = await supabase.from('atlas_day_items')
                .insert([{ ...asAtlasItem(reservation), day_id: target.id, user_id: user.id }]);
            if (e) throw e;

            const label = labelDay(target, pretty);
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

    const close = () => { setOpen(false); setDone(null); setError(null); setChosen(''); };

    return (
        <>
            <Button size="sm" onClick={() => setOpen(true)} title="Put this booking on a day">
                <GiCalendar /> Add to a day
            </Button>

            <Modal open={open} onClose={close} title="Put this booking on a day">
                {done ? (
                    <div className="send-atlas">
                        <p><strong>{reservation.name}</strong> is on {done}.</p>
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
                            {reservation.name}
                            {on ? ` · ${pretty(on)}` : ''}
                            {bookingNote(reservation) ? ` · ${bookingNote(reservation)}` : ''}
                        </p>

                        {loading && <p className="send-atlas__why">Looking through your trips…</p>}

                        {!loading && settled && (
                            <p className="send-atlas__matched">
                                Lands on <strong>{labelDay(settled, pretty)}</strong>, matched from the
                                booking’s own date.
                            </p>
                        )}

                        {!loading && !settled && (
                            <>
                                <p className="send-atlas__why">
                                    {matches.length > 1
                                        ? `Two trips cover ${pretty(on)} — which one?`
                                        : on
                                            ? `Nothing in the Atlas covers ${pretty(on)} yet.`
                                            : 'This booking has no date, so pick the day yourself.'}
                                </p>

                                {/* What is near it, when nothing is on it. "No day
                                    matches" is true and useless; which trips are
                                    close is what lets her decide whether to
                                    stretch a trip's dates instead. */}
                                {matches.length === 0 && near.length > 0 && (
                                    <p className="send-atlas__why">
                                        Closest: {near.slice(0, 2).map((d) => labelDay(d, pretty)).join(', ')}.
                                    </p>
                                )}

                                <label className="send-atlas__field">
                                    <span>Which day</span>
                                    <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
                                        <option value="">Choose a day…</option>
                                        {(matches.length > 1 ? matches : choices).map((d) => (
                                            <option key={d.id} value={d.id}>{labelDay(d, pretty)}</option>
                                        ))}
                                    </select>
                                </label>

                                {!choices.length && !loading && (
                                    <p className="send-atlas__why">
                                        No trip in the Atlas has any dates yet. Give one a start and end
                                        date and its days appear here.
                                    </p>
                                )}
                            </>
                        )}

                        {error && <p className="send-atlas__warn">{error}</p>}

                        <div className="send-atlas__acts">
                            <Button onClick={close}>Cancel</Button>
                            <Button variant="solid" disabled={!target || busy} onClick={place}>
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
