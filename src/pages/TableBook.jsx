import React, { useState, useMemo } from 'react';
import {
    GiForkKnifeSpoon, GiCheckMark, GiTrashCan, GiPositionMarker,
    GiQuill, GiClockwork, GiWineGlass,
} from 'react-icons/gi';
import {
    Button, Card, PageHeader, Tabs, TabPanel, Modal, Field, Tag, Stat,
    ConfirmButton, EmptyState,
} from '../components/ui';
import { useReservations } from '../hooks/useReservations';
import { useSpots } from '../hooks/useSpots';
import '../styles/TableBook.css';

const PLATFORMS = ['OpenTable', 'Resy', 'Tock', 'Yelp', 'Google', 'SevenRooms', 'Direct', 'Other'];

/** Categories where "a reservation" is a thing that exists. */
const EATING = ['restaurant', 'bar', 'cafe'];

const EMPTY_FORM = {
    restaurant: '', spot_id: '', date: '', time: '19:00', party_size: '2',
    platform: 'OpenTable', confirmation: '', seating: '', city: '', notes: '',
};

const STATUS_LABEL = { booked: 'Booked', dined: 'Dined', cancelled: 'Cancelled', no_show: 'No-show' };

const fmtDay = (iso) => new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
});
const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
});
const fmtShort = (iso) => new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
});

/** Whole days from now, so "tomorrow" reads as tomorrow all day rather than flipping at a clock time. */
const daysAway = (iso) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const then = new Date(iso); then.setHours(0, 0, 0, 0);
    return Math.round((then - start) / 86400000);
};

const countdown = (iso) => {
    const d = daysAway(iso);
    if (d < 0) return 'Passed';
    if (d === 0) return 'Today';
    if (d === 1) return 'Tomorrow';
    return `In ${d} days`;
};

/**
 * The Table Book — every restaurant reservation, held and historic.
 *
 * The Spots library records wanting to go somewhere. This records going. The
 * third tab is the gap between the two: places she booked and let go without
 * ever rebooking, and saved spots that never became a table at all.
 *
 * It is a tab of the Daydream rather than a room of its own now. Booking a
 * table is not a different activity from planning the day the table is in,
 * and two rooms meant deciding which one to walk into before you knew.
 * `embedded` drops the page furniture — the whole-page heading and the room's
 * own name — and leaves the content, which is all a tab needs.
 */
const TableBook = ({ embedded = false }) => {
    const {
        upcoming, past, reservations, loading, error,
        addReservation, markDined, cancelReservation, deleteReservation,
    } = useReservations();
    const { spots } = useSpots();

    const [tab, setTab] = useState('held');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const kept = useMemo(() => reservations.filter((r) => r.status === 'dined').length, [reservations]);
    const letGo = useMemo(
        () => reservations.filter((r) => r.status === 'cancelled' || r.status === 'no_show').length,
        [reservations]
    );

    /**
     * Somewhere she cancelled and never went back to. The interest was real
     * enough to book once — it is the most honest wishlist the app has.
     */
    const lapsed = useMemo(() => {
        const settled = new Set(
            reservations.filter((r) => r.status === 'dined').map((r) => r.restaurant.toLowerCase())
        );
        const stillLive = new Set(upcoming.map((r) => r.restaurant.toLowerCase()));
        const seen = new Map();
        reservations
            .filter((r) => r.status === 'cancelled' || r.status === 'no_show')
            .forEach((r) => {
                const key = r.restaurant.toLowerCase();
                if (settled.has(key) || stillLive.has(key)) return;
                const prior = seen.get(key);
                seen.set(key, {
                    restaurant: r.restaurant,
                    city: r.city || prior?.city,
                    attempts: (prior?.attempts || 0) + 1,
                    last: prior ? prior.last : r.starts_at,
                });
            });
        return [...seen.values()].sort((a, b) => b.attempts - a.attempts);
    }, [reservations, upcoming]);

    /** Saved eating spots that have never had a table booked against them. */
    const unbooked = useMemo(() => {
        const booked = new Set(reservations.map((r) => r.spot_id).filter(Boolean));
        const byName = new Set(reservations.map((r) => r.restaurant.toLowerCase()));
        return spots.filter((s) => (
            s.status !== 'been'
            && EATING.includes(s.category)
            && !booked.has(s.id)
            && !byName.has((s.name || '').toLowerCase())
        ));
    }, [spots, reservations]);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.restaurant.trim() || !form.date || saving) return;
        setSaving(true);
        try {
            const linked = spots.find((s) => s.id === form.spot_id);
            await addReservation({
                restaurant: form.restaurant.trim(),
                starts_at: new Date(`${form.date}T${form.time || '19:00'}`).toISOString(),
                party_size: form.party_size,
                platform: form.platform,
                confirmation: form.confirmation.trim() || null,
                seating: form.seating.trim() || null,
                city: form.city.trim() || linked?.city || null,
                address: linked?.address || null,
                phone: linked?.phone || null,
                spot_id: form.spot_id || null,
                notes: form.notes.trim() || null,
            });
            setForm(EMPTY_FORM);
            setFormOpen(false);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    /** Pre-fill the form from a saved spot so booking one is two clicks. */
    const bookFrom = (spot) => {
        setForm({ ...EMPTY_FORM, restaurant: spot.name, spot_id: spot.id, city: spot.city || '' });
        setFormOpen(true);
    };

    const next = upcoming[0];

    const book = () => { setForm(EMPTY_FORM); setFormOpen(true); };

    return (
        <div className={`tablebook${embedded ? ' is-embedded' : ''}`}>
            {embedded ? (
                <header className="tablebook__head">
                    <div>
                        <h2 className="section-title"><GiForkKnifeSpoon /> The Table Book</h2>
                        <p>Tables held, tables kept, and the ones still worth chasing.</p>
                    </div>
                    <Button variant="solid" onClick={book}><GiQuill /> Book a table</Button>
                </header>
            ) : (
                <PageHeader
                    title="The Table Book"
                    icon={<GiForkKnifeSpoon />}
                    subtitle="Tables held, tables kept, and the ones still worth chasing."
                    actions={
                        <Button variant="solid" onClick={book}>
                            <GiQuill /> Book a table
                        </Button>
                    }
                />
            )}

            {error && <p className="tablebook__error">{error}</p>}

            <div className="tablebook__stats">
                <Stat
                    value={next ? countdown(next.starts_at) : '—'}
                    label={next ? next.restaurant : 'Nothing booked'}
                    icon={<GiClockwork />}
                />
                <Stat value={upcoming.length} label="On the books" icon={<GiForkKnifeSpoon />} />
                <Stat value={kept} label="Kept" icon={<GiCheckMark />} />
                <Stat value={letGo} label="Let go" icon={<GiWineGlass />} />
            </div>

            <Tabs
                label="Table book"
                variant={embedded ? 'segmented' : 'underline'}
                active={tab}
                onChange={setTab}
                tabs={[
                    { id: 'held', label: 'On the books', count: upcoming.length },
                    { id: 'history', label: 'The full book', count: past.length },
                    { id: 'chasing', label: 'Worth chasing', count: lapsed.length + unbooked.length },
                ]}
            />

            {loading ? <p className="muted">Reading your table book…</p> : (
                <>
                    <TabPanel id="held" active={tab}>
                        {upcoming.length === 0 ? (
                            <EmptyState
                                icon={<GiForkKnifeSpoon />}
                                message="No tables held."
                                hint="Book one above, or pick something off Worth chasing."
                            />
                        ) : (
                            <ul className="tablebook__slips">
                                {upcoming.map((r) => {
                                    const soon = daysAway(r.starts_at) <= 3;
                                    return (
                                        <li key={r.id}>
                                            <Card
                                                variant="flat"
                                                bodyClassName="slip__grid"
                                                className={`slip${soon ? ' slip--soon' : ''}`}
                                            >
                                                <div className="slip__when">
                                                    <span className="slip__day">{fmtDay(r.starts_at)}</span>
                                                    <span className="slip__time">{fmtTime(r.starts_at)}</span>
                                                    <span className="slip__count">{countdown(r.starts_at)}</span>
                                                </div>

                                                <div className="slip__body">
                                                    <h3 className="slip__name">{r.restaurant}</h3>
                                                    <p className="slip__where">
                                                        <span aria-hidden="true"><GiPositionMarker /></span>
                                                        {[r.seating, r.party_size && `party of ${r.party_size}`, r.address || r.city]
                                                            .filter(Boolean).join(' · ')}
                                                    </p>
                                                    <div className="slip__tags">
                                                        {r.platform && <Tag>{r.platform}</Tag>}
                                                        {r.confirmation && <Tag>#{r.confirmation}</Tag>}
                                                        {r.spot_id && <Tag>From your spots</Tag>}
                                                    </div>
                                                    {r.cancel_by && (
                                                        <p className="slip__deadline">
                                                            Free to cancel until {fmtShort(r.cancel_by)}
                                                            {r.cancel_fee ? ` — after that it's ${r.cancel_fee}` : ''}
                                                        </p>
                                                    )}
                                                    {r.notes && <p className="slip__notes">{r.notes}</p>}
                                                </div>

                                                <div className="slip__actions">
                                                    <Button size="sm" onClick={() => markDined(r)}>
                                                        <GiCheckMark /> Went
                                                    </Button>
                                                    <Button size="sm" onClick={() => cancelReservation(r)}>
                                                        Cancelled it
                                                    </Button>
                                                    <ConfirmButton
                                                        size="sm" icon
                                                        label={`Delete the ${r.restaurant} booking`}
                                                        onConfirm={() => deleteReservation(r.id)}
                                                    >
                                                        <GiTrashCan />
                                                    </ConfirmButton>
                                                </div>
                                            </Card>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </TabPanel>

                    <TabPanel id="history" active={tab}>
                        {past.length === 0 ? (
                            <EmptyState icon={<GiForkKnifeSpoon />} message="No history yet." />
                        ) : (
                            <div className="tablebook__scroll">
                                <table className="ledger">
                                    <thead>
                                        <tr>
                                            <th scope="col">Date</th>
                                            <th scope="col">Restaurant</th>
                                            <th scope="col">Party</th>
                                            <th scope="col">Booked via</th>
                                            <th scope="col">Outcome</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {past.map((r) => (
                                            <tr key={r.id}>
                                                <td className="ledger__date">{fmtShort(r.starts_at)}</td>
                                                <td>
                                                    <strong>{r.restaurant}</strong>
                                                    {(r.city || r.seating) && (
                                                        <span className="ledger__sub">
                                                            {[r.city, r.seating].filter(Boolean).join(' · ')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{r.party_size || '—'}</td>
                                                <td className="ledger__plat">{r.platform || '—'}</td>
                                                <td>
                                                    <span className={`outcome outcome--${r.status}`}>
                                                        {STATUS_LABEL[r.status] || r.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TabPanel>

                    <TabPanel id="chasing" active={tab}>
                        {lapsed.length === 0 && unbooked.length === 0 ? (
                            <EmptyState
                                icon={<GiPositionMarker />}
                                message="Nothing outstanding."
                                hint="Everywhere you've booked, you've been."
                            />
                        ) : (
                            <div className="chasing">
                                {lapsed.length > 0 && (
                                    <section>
                                        <h2 className="chasing__heading">Booked and let go</h2>
                                        <p className="chasing__lede">
                                            You wanted to go enough to book. Then it slipped, and never came back.
                                        </p>
                                        <ul className="chasing__list">
                                            {lapsed.map((p) => (
                                                <li key={p.restaurant} className="chasing__row">
                                                    <div>
                                                        <h3>{p.restaurant}</h3>
                                                        <p>
                                                            {[p.city, `last tried ${fmtShort(p.last)}`]
                                                                .filter(Boolean).join(' · ')}
                                                        </p>
                                                    </div>
                                                    <span className="chasing__why">
                                                        {p.attempts > 1 ? `${p.attempts} attempts` : 'Cancelled'}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}

                                {unbooked.length > 0 && (
                                    <section>
                                        <h2 className="chasing__heading">Saved, never booked</h2>
                                        <p className="chasing__lede">
                                            Places sitting in your spots library that have never become a table.
                                        </p>
                                        <ul className="chasing__list">
                                            {unbooked.map((s) => (
                                                <li key={s.id} className="chasing__row">
                                                    <div>
                                                        <h3>{s.name}</h3>
                                                        <p>
                                                            {[s.neighborhood, s.city].filter(Boolean).join(', ')}
                                                            {s.why ? ` — “${s.why}”` : ''}
                                                        </p>
                                                    </div>
                                                    <Button size="sm" onClick={() => bookFrom(s)}>
                                                        Book it
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
                            </div>
                        )}
                    </TabPanel>
                </>
            )}

            <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Book a table">
                <form className="tablebook__form" onSubmit={submit}>
                    <Field
                        label="Restaurant"
                        placeholder="Bosco"
                        value={form.restaurant}
                        onChange={(e) => setForm({ ...form, restaurant: e.target.value })}
                    />
                    <Field
                        label="Date"
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                    <Field
                        label="Time"
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                    />
                    <Field
                        label="Party size"
                        type="number"
                        min="1"
                        value={form.party_size}
                        onChange={(e) => setForm({ ...form, party_size: e.target.value })}
                    />
                    <Field
                        label="Booked via"
                        as="select"
                        value={form.platform}
                        onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    >
                        {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </Field>
                    <Field
                        label="Confirmation number"
                        placeholder="7267"
                        value={form.confirmation}
                        onChange={(e) => setForm({ ...form, confirmation: e.target.value })}
                    />
                    <Field
                        label="Seating"
                        placeholder="Chef's counter"
                        value={form.seating}
                        onChange={(e) => setForm({ ...form, seating: e.target.value })}
                    />
                    <Field
                        label="City"
                        placeholder="San Francisco"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                    <Field
                        label="Anything to remember"
                        as="textarea"
                        rows={2}
                        placeholder="Set menu, no substitutions. $120pp if cancelled inside 24h."
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className="tablebook__form-wide"
                    />
                    <div className="tablebook__form-actions">
                        <Button type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="solid"
                            disabled={!form.restaurant.trim() || !form.date || saving}
                        >
                            {saving ? 'Writing it down…' : 'Hold the table'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default TableBook;
