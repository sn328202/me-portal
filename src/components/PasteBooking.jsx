import React, { useState } from 'react';
import { Button, Modal } from './ui';
import { supabase } from '../lib/supabase';
import { TYPES, faceOf, summaryOf, dateOf, saveBookings, inTrip } from '../utils/bookingSave';
import '../styles/Bookings.css';

const fmtDay = (value) => (value
    ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short',
    })
    : '');

/**
 * Paste any confirmation — a table, a flight, a gig, a hotel, or an email
 * holding several — and it is sorted into the right book.
 *
 * Given a `trip`, everything saved also goes onto the matching day of that
 * trip, and a hotel becomes one of the trip's stays.
 */
const PasteBooking = ({ open, onClose, trip = null, days = [], onSaved }) => {
    const [paste, setPaste] = useState('');
    const [reading, setReading] = useState(false);
    const [error, setError] = useState(null);
    const [found, setFound] = useState([]);
    const [chosen, setChosen] = useState([]);
    const [dropped, setDropped] = useState(0);
    const [saving, setSaving] = useState(false);
    const [report, setReport] = useState(null);

    const reset = () => {
        setPaste(''); setReading(false); setError(null); setFound([]);
        setChosen([]); setDropped(0); setSaving(false); setReport(null);
    };
    const close = () => { reset(); onClose?.(); };

    const read = async () => {
        const text = paste.trim();
        if (text.length < 20 || reading) return;
        setReading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/booking-parse', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    Authorization: `Bearer ${session?.access_token || ''}`,
                },
                body: JSON.stringify({ text }),
            });
            const json = await res.json();
            if (!json.ok) { setError(json.error || 'Could not read that one.'); return; }
            setFound(json.items || []);
            setChosen((json.items || []).map((_, i) => i));
            setDropped(json.dropped || 0);
        } catch (err) {
            console.error(err);
            setError('Could not read that one.');
        } finally {
            setReading(false);
        }
    };

    const toggle = (i) => setChosen((prev) => (
        prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i]
    ));

    const save = async () => {
        if (saving || !chosen.length) return;
        setSaving(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');
            const result = await saveBookings(
                supabase, found.filter((_, i) => chosen.includes(i)),
                { userId: user.id, trip, days }
            );
            setReport(result);
            onSaved?.(result);
        } catch (err) {
            console.error(err);
            setError('That did not save. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const title = report ? 'Saved' : found.length ? 'What it found' : 'Paste a confirmation';

    return (
        <Modal open={open} onClose={close} title={title}>
            <div className="bookings__paste">
                {report ? (
                    <>
                        <p>
                            {report.saved} saved
                            {trip ? `, ${report.placed} put on ${trip.destination || 'this trip'}’s days` : ''}.
                        </p>
                        {report.offTrip.length > 0 && (
                            <p className="bookings__warn">
                                Not inside this trip’s dates, so saved to Bookings only: {report.offTrip.join(', ')}.
                            </p>
                        )}
                        {report.failed.length > 0 && (
                            <p className="bookings__warn">Did not save: {report.failed.join(', ')}.</p>
                        )}
                        <div className="bookings__paste-acts">
                            <Button onClick={reset}>Paste another</Button>
                            <Button variant="solid" onClick={close}>Done</Button>
                        </div>
                    </>
                ) : found.length ? (
                    <>
                        <p>
                            Untick anything you don’t want. Nothing is saved until you press the button.
                            {trip ? ' Everything in this trip’s dates goes straight onto its day.' : ''}
                        </p>
                        {dropped > 0 && (
                            <p className="bookings__warn">
                                {dropped === 1 ? 'One more booking was' : `${dropped} more bookings were`} in there
                                without a date it could read. Add {dropped === 1 ? 'it' : 'them'} by hand.
                            </p>
                        )}
                        <ul className="bookings__found">
                            {found.map((item, i) => {
                                const date = dateOf(item);
                                const outside = trip && !inTrip(date, trip);
                                return (
                                    <li key={`${item.type}-${date}-${i}`}>
                                        <label className="bookings__item">
                                            <input type="checkbox" checked={chosen.includes(i)} onChange={() => toggle(i)} />
                                            <span className="bookings__face" aria-hidden="true">{faceOf(item)}</span>
                                            <span className="bookings__body">
                                                <strong>{summaryOf(item)}</strong>
                                                <span className="bookings__meta">
                                                    <em className={`bookings__type bookings__type--${item.type}`}>
                                                        {TYPES[item.type]?.label}
                                                    </em>
                                                    {' '}{fmtDay(date)}
                                                    {item.type === 'stay' ? ` → ${fmtDay(item.check_out)}` : ''}
                                                    {item.confirmation ? ` · #${item.confirmation}` : ''}
                                                    {outside ? ' · outside this trip' : ''}
                                                </span>
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                        {error && <p className="bookings__error">{error}</p>}
                        <div className="bookings__paste-acts">
                            <Button onClick={reset}>Start over</Button>
                            <Button variant="solid" disabled={!chosen.length || saving} onClick={save}>
                                {saving ? 'Saving…' : `Save ${chosen.length}`}
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <p>
                            Any confirmation: a restaurant, flight, train, hotel, concert or tour. It works out
                            what each one is. An email with several bookings in it is fine.
                        </p>
                        <textarea
                            rows={12}
                            autoFocus
                            aria-label="The confirmation email"
                            placeholder="Paste the whole email here…"
                            value={paste}
                            onChange={(e) => setPaste(e.target.value)}
                        />
                        {error && <p className="bookings__error">{error}</p>}
                        <div className="bookings__paste-acts">
                            <Button onClick={close}>Cancel</Button>
                            <Button variant="solid" disabled={paste.trim().length < 20 || reading} onClick={read}>
                                {reading ? 'Reading…' : 'Read it'}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default PasteBooking;
