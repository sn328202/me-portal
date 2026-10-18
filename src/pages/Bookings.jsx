import React, { lazy, Suspense, useMemo, useState } from 'react';
import { GiEnvelope, GiTrashCan, GiQuill } from 'react-icons/gi';
import { Button, Card, Modal, Field, Tag, ConfirmButton, EmptyState } from '../components/ui';
import PasteBooking from '../components/PasteBooking';
import { useReservations } from '../hooks/useReservations';
import { useJourneys } from '../hooks/useJourneys';
import { useGigs } from '../hooks/useGigs';
import { useStays } from '../hooks/useStays';
import { mergeUpcoming } from '../utils/bookingsList';
import { TYPES } from '../utils/bookingSave';
import { todayLocal } from '../utils/today';
import { formatMoney } from '../utils/tripCosts';
import '../styles/BookingSlip.css';
import '../styles/Bookings.css';

const TableBook = lazy(() => import('./TableBook'));
const TicketBook = lazy(() => import('./TicketBook'));
const GigBook = lazy(() => import('./GigBook'));

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'tables', label: '🍽️ Tables & tours' },
    { id: 'travel', label: '✈️ Travel' },
    { id: 'hotels', label: '🛏️ Hotels' },
    { id: 'gigs', label: '🎤 Gigs' },
];

const fmtDay = (value) => new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
});

const BLANK_STAY = { name: '', city: '', check_in: '', check_out: '', cost: '', currency: 'USD', confirmation: '', notes: '' };

/** Hotels: every stay, whether or not a trip has claimed it yet. */
const HotelBook = ({ stays }) => {
    const { list, loading, addStay, deleteStay } = stays;
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(BLANK_STAY);
    const [saving, setSaving] = useState(false);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const today = todayLocal();
    const ahead = list.filter((s) => s.check_out >= today);
    const past = list.filter((s) => s.check_out < today).reverse();
    const valid = form.name.trim() && form.check_in && form.check_out && form.check_out > form.check_in;

    const submit = async (e) => {
        e.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        try {
            await addStay({
                name: form.name.trim(), city: form.city.trim() || null,
                check_in: form.check_in, check_out: form.check_out,
                cost: form.cost === '' ? 0 : Number(form.cost),
                currency: form.cost === '' ? null : form.currency.toUpperCase(),
                confirmation: form.confirmation.trim() || null, notes: form.notes.trim() || null,
            });
            setForm(BLANK_STAY);
            setOpen(false);
        } finally {
            setSaving(false);
        }
    };

    const slip = (s) => (
        <li key={s.id}>
            <Card variant="flat" bodyClassName="slip__grid" className="slip">
                <div className="slip__when">
                    <span className="slip__day">{fmtDay(s.check_in)}</span>
                    <span className="slip__count">to {fmtDay(s.check_out)}</span>
                </div>
                <div className="slip__body">
                    <h3 className="slip__name"><span className="slip__face" aria-hidden="true">🛏️</span>{s.name}</h3>
                    {(s.city || s.address) && <p className="slip__where">{s.address || s.city}</p>}
                    <div className="slip__tags">
                        <Tag>{s.atlas_trips?.destination ? `On ${s.atlas_trips.destination}` : 'Waiting for a trip'}</Tag>
                        {s.confirmation && <Tag>#{s.confirmation}</Tag>}
                        {Number(s.cost) > 0 && <Tag>{formatMoney(s.cost, s.currency || 'USD')}</Tag>}
                    </div>
                    {s.notes && <p className="slip__notes">{s.notes}</p>}
                </div>
                <ConfirmButton className="slip__drop" size="sm" icon label={`Delete ${s.name}`} onConfirm={() => deleteStay(s.id)}>
                    <GiTrashCan />
                </ConfirmButton>
            </Card>
        </li>
    );

    return (
        <section className="bookings__hotels">
            <div className="bookings__subhead">
                <p>A hotel with no trip yet joins the trip whose dates cover its check-in as soon as you open that trip.</p>
                <Button onClick={() => setOpen(true)}><GiQuill /> Add a hotel</Button>
            </div>
            {loading ? <p className="muted">Reading your hotels…</p> : ahead.length === 0 && past.length === 0 ? (
                <EmptyState icon={<span>🛏️</span>} message="No hotels yet." hint="Paste a hotel confirmation above, or add one." />
            ) : (
                <>
                    {ahead.length > 0 && <ul className="bookings__slips">{ahead.map(slip)}</ul>}
                    {past.length > 0 && (
                        <details className="bookings__past">
                            <summary>Stayed ({past.length})</summary>
                            <ul className="bookings__slips">{past.map(slip)}</ul>
                        </details>
                    )}
                </>
            )}
            <Modal open={open} onClose={() => setOpen(false)} title="Add a hotel">
                <form className="bookings__form" onSubmit={submit}>
                    <Field label="Hotel" placeholder="Hotel Emma" value={form.name} onChange={set('name')} required />
                    <Field label="City" placeholder="San Antonio" value={form.city} onChange={set('city')} />
                    <Field label="Check in" type="date" value={form.check_in} onChange={set('check_in')} required />
                    <Field label="Check out" type="date" value={form.check_out} onChange={set('check_out')} required />
                    <Field label="Total cost" type="number" min="0" step="0.01" value={form.cost} onChange={set('cost')} />
                    <Field label="Currency" value={form.currency} onChange={set('currency')} />
                    <Field label="Confirmation" value={form.confirmation} onChange={set('confirmation')} />
                    <Field label="Notes" as="textarea" rows={2} value={form.notes} onChange={set('notes')} className="bookings__wide" />
                    <div className="bookings__paste-acts bookings__wide">
                        <Button type="button" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="solid" disabled={!valid || saving}>{saving ? 'Saving…' : 'Save hotel'}</Button>
                    </div>
                </form>
            </Modal>
        </section>
    );
};

/** Everything coming up, of every kind, in date order. */
const AllUpcoming = ({ rows }) => (rows.length === 0 ? (
    <EmptyState icon={<span>🧳</span>} message="Nothing booked yet." hint="Paste any confirmation above." />
) : (
    <ul className="bookings__all">
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
                    {r.placed && <Tag>On {r.placed}</Tag>}
                </span>
            </li>
        ))}
    </ul>
));

/**
 * The Bookings room: one paste box for every kind of booking, and one list of
 * everything held. The filter chips open each book's own fuller view.
 */
const Bookings = ({ filter = 'all', onFilter }) => {
    const [pasting, setPasting] = useState(false);
    // Bumped after a paste so an open book re-reads what was just saved.
    const [bump, setBump] = useState(0);
    const res = useReservations();
    const jou = useJourneys();
    const gig = useGigs();
    const st = useStays();

    const tripNames = useMemo(() => Object.fromEntries(
        st.stays.filter((s) => s.atlas_trips).map((s) => [s.trip_id, s.atlas_trips.destination])
    ), [st.stays]);

    const upcoming = useMemo(() => mergeUpcoming({
        reservations: res.reservations, journeys: jou.journeys, gigs: gig.gigs, stays: st.stays,
    }, todayLocal(), tripNames), [res.reservations, jou.journeys, gig.gigs, st.stays, tripNames]);

    const counts = useMemo(() => ({
        all: upcoming.length,
        tables: upcoming.filter((r) => r.type === 'table').length,
        travel: upcoming.filter((r) => r.type === 'journey').length,
        hotels: upcoming.filter((r) => r.type === 'stay').length,
        gigs: upcoming.filter((r) => r.type === 'gig').length,
    }), [upcoming]);

    const refreshAll = () => {
        res.refresh(); jou.refresh(); gig.refresh(); st.refresh();
        setBump((n) => n + 1);
    };

    return (
        <div className="bookings">
            <header className="bookings__head">
                <div>
                    <h2 className="section-title">🧳 Bookings</h2>
                    <p>Every table, ticket, flight and hotel in one place. Paste any confirmation and it is filed where it belongs.</p>
                </div>
                <Button variant="solid" onClick={() => setPasting(true)}><GiEnvelope /> Paste any confirmation</Button>
            </header>

            <div className="bookings__chips" role="tablist" aria-label="Show">
                {FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === f.id}
                        className={`bookings__chip${filter === f.id ? ' is-on' : ''}`}
                        onClick={() => onFilter?.(f.id)}
                    >
                        {f.label} <span className="bookings__count">{counts[f.id]}</span>
                    </button>
                ))}
            </div>

            {filter === 'all' && (
                (res.loading || jou.loading || gig.loading || st.loading)
                    ? <p className="muted">Reading your bookings…</p>
                    : <AllUpcoming rows={upcoming} />
            )}
            <Suspense fallback={<p className="muted">Opening…</p>}>
                {filter === 'tables' && <TableBook key={bump} embedded />}
                {filter === 'travel' && <TicketBook key={bump} embedded />}
                {filter === 'gigs' && <GigBook key={bump} embedded />}
            </Suspense>
            {filter === 'hotels' && (
                <HotelBook stays={{ list: st.stays, loading: st.loading, addStay: st.addStay, deleteStay: st.deleteStay }} />
            )}

            <PasteBooking open={pasting} onClose={() => setPasting(false)} onSaved={refreshAll} />
        </div>
    );
};

export default Bookings;
