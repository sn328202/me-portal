import React, { useState, useMemo } from 'react';
import {
    GiForkKnifeSpoon, GiCheckMark, GiTrashCan, GiPositionMarker,
    GiQuill, GiClockwork, GiWineGlass, GiEnvelope,
} from 'react-icons/gi';
import {
    Button, Card, PageHeader, Tabs, TabPanel, Modal, Field, Tag, Stat,
    ConfirmButton, EmptyState,
} from '../components/ui';
import { useReservations } from '../hooks/useReservations';
import { supabase } from '../lib/supabase';
import { looksLike, fillFrom } from '../utils/placeMatch';
import AddBookingToDay from '../components/AddBookingToDay';
import MentionInput from '../components/MentionInput';
import { KINDS, faceOf, labelOf, guessKind } from '../utils/bookingKinds';
import '../styles/TableBook.css';

const PLATFORMS = ['OpenTable', 'Resy', 'Tock', 'Yelp', 'Google', 'SevenRooms', 'Direct', 'Other'];

const EMPTY_FORM = {
    name: '', kind: 'table', date: '', time: '19:00', party_size: '2',
    platform: 'OpenTable', confirmation: '', seating: '', city: '', notes: '',
    /* Filled in when the restaurant is picked from Google rather than typed.
       A booking that knows which restaurant it is can link to it — and so can
       the itinerary card it becomes. */
    address: '', phone: '', maps_url: '', place_id: '', website: '', rating: null,
};

const STATUS_LABEL = { booked: 'Booked', dined: 'Dined', cancelled: 'Cancelled', no_show: 'No-show' };

/* Short forms. "Sunday, August 30" is nineteen characters in a rail five and
   a half rems wide, so it broke into three lines and put the 30 on one of its
   own. Nothing on a booking slip needs the word September spelled out. */
const fmtDay = (iso) => new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
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
 * The Table Book — every booking, held and historic.
 *
 * There used to be a third tab, "Worth chasing", built on the Spots library:
 * places booked and let go without rebooking, and saved spots that never
 * became a table. Spots is gone — a place she wants to check out goes to the
 * Commonplace now — and this is the tables, held and kept, which is what it
 * was always for.
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
        addReservation, markDined, cancelReservation, deleteReservation, refresh,
        updateReservation,
    } = useReservations();

    const [tab, setTab] = useState('held');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    /* Pasting a confirmation. Kept beside the form rather than replacing it:
       the parse fills the form in and she presses save, because a
       confirmation for the wrong Tuesday that saved itself is worse than no
       parser at all. */
    const [pasting, setPasting] = useState(false);
    const [paste, setPaste] = useState('');
    const [reading, setReading] = useState(false);
    const [readError, setReadError] = useState(null);
    /* Going back over the bookings made before the Table Book knew what a
       place was, and finding each one on Google. */
    const [linking, setLinking] = useState(false);
    const [linked, setLinked] = useState(null);

    const kept = useMemo(() => reservations.filter((r) => r.status === 'dined').length, [reservations]);
    const letGo = useMemo(
        () => reservations.filter((r) => r.status === 'cancelled' || r.status === 'no_show').length,
        [reservations]
    );

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.date || saving) return;
        setSaving(true);
        try {
            await addReservation({
                name: form.name.trim(),
                kind: form.kind || 'table',
                starts_at: new Date(`${form.date}T${form.time || '19:00'}`).toISOString(),
                party_size: form.party_size,
                platform: form.platform,
                confirmation: form.confirmation.trim() || null,
                seating: form.seating.trim() || null,
                city: form.city.trim() || null,
                // The form carries the place itself now: the @ picker, the
                // paste parser and nothing else fill these in.
                address: form.address || null,
                phone: form.phone || null,
                maps_url: form.maps_url || null,
                place_id: form.place_id || null,
                website: form.website || null,
                rating: form.rating ?? null,
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


    const readPaste = async () => {
        const text = paste.trim();
        if (text.length < 20 || reading) return;
        setReading(true);
        setReadError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/reservation-parse', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    Authorization: `Bearer ${session?.access_token || ''}`,
                },
                body: JSON.stringify({ text }),
            });
            const json = await res.json();
            if (!json.ok) { setReadError(json.error || 'Could not read that one.'); return; }

            const d = json.draft;
            setForm({
                ...EMPTY_FORM,
                name: d.restaurant || d.name || '',
                /* The sender knows what it sold her; the shape of the email
                   does not say. A wrong guess is one click to fix. */
                kind: guessKind(`${d.restaurant || d.name || ''} ${d.notes || ''}`),
                date: d.date || '',
                time: d.time || '19:00',
                party_size: d.party_size ? String(d.party_size) : '2',
                platform: PLATFORMS.includes(d.platform) ? d.platform : 'Other',
                confirmation: d.confirmation || '',
                seating: d.seating || '',
                city: d.city || '',
                address: d.address || '',
                phone: d.phone || '',
                notes: [d.notes, d.cancel_by && `Free to cancel until ${fmtShort(d.cancel_by)}`,
                    d.cancel_fee && `After that: ${d.cancel_fee}`].filter(Boolean).join(' — '),
            });
            setPaste('');
            setPasting(false);
            setFormOpen(true);

            /* And find the restaurant itself, so a pasted confirmation ends up
               as well furnished as one picked by hand: address, map link, the
               lot. Best-effort — a booking with no map link is still a
               booking. */
            try {
                const look = await fetch('/api/place-search', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        Authorization: `Bearer ${session?.access_token || ''}`,
                    },
                    body: JSON.stringify({
                        q: d.restaurant || d.name,
                        city: d.city || null,
                        limit: 1,
                    }),
                });
                const found = (await look.json())?.places?.[0];
                if (found?.maps_url) {
                    setForm((f) => ({
                        ...f,
                        address: f.address || found.address || '',
                        maps_url: found.maps_url,
                        place_id: found.place_id || '',
                        rating: found.rating ?? null,
                    }));
                }
            } catch {
                /* no map link, then */
            }
        } catch (err) {
            console.error(err);
            setReadError('Could not read that one.');
        } finally {
            setReading(false);
        }
    };

    /* Bookings taken before the form learned about places: a restaurant name,
       a time, and nothing to tap. There is no reason she should retype an
       address the map already has. */
    const unlinked = useMemo(
        () => reservations.filter((r) => !r.place_id && !r.maps_url && String(r.name || r.restaurant || '').trim()),
        [reservations]
    );

    /**
     * Find the old bookings on Google, one at a time.
     *
     * Serial rather than parallel, because a burst of lookups is how you get
     * rate-limited into a run of empty answers that look like failures.
     *
     * And only accepted when the name it found is defensibly the name she
     * wrote — a booking confidently carrying the wrong address is worse than
     * one carrying none, because she would drive to it. The rest are counted
     * and reported so she knows what is still hers to do.
     */
    const linkUp = async () => {
        if (linking || !unlinked.length) return;
        setLinking(true);
        setLinked(null);

        const { data: { session } } = await supabase.auth.getSession();
        let found = 0;
        let unsure = 0;

        for (const r of unlinked) {
            try {
                const res = await fetch('/api/place-search', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        Authorization: `Bearer ${session?.access_token || ''}`,
                    },
                    body: JSON.stringify({ q: r.name || r.restaurant, city: r.city || null, limit: 3 }),
                });
                const places = (await res.json())?.places || [];
                const match = places.find((p) => looksLike(r.name || r.restaurant, p.name, r.city));

                if (!match) { unsure += 1; continue; }

                const patch = fillFrom(r, match);
                if (Object.keys(patch).length) {
                    await updateReservation(r.id, patch);
                    found += 1;
                } else {
                    unsure += 1;
                }
            } catch {
                unsure += 1;
            }
        }

        setLinked({ found, unsure });
        setLinking(false);
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
                    <div className="tablebook__acts">
                        <Button onClick={() => { setReadError(null); setPasting(true); }}>
                            <GiEnvelope /> Paste a confirmation
                        </Button>
                        {/* Only offered when there is something to do:
                            once every booking carries a place, this is
                            noise. */}
                        {unlinked.length > 0 && (
                            <Button onClick={linkUp} disabled={linking}>
                                <GiPositionMarker /> {linking
                                    ? 'Looking them up…'
                                    : `Find ${unlinked.length} on Google`}
                            </Button>
                        )}
                        <Button variant="solid" onClick={book}><GiQuill /> Book a table</Button>
                    </div>
                </header>
            ) : (
                <PageHeader
                    title="The Table Book"
                    icon={<GiForkKnifeSpoon />}
                    subtitle="Tables held, tables kept, and the ones still worth chasing."
                    actions={
                        <div className="tablebook__acts">
                            <Button onClick={() => { setReadError(null); setPasting(true); }}>
                                <GiEnvelope /> Paste a confirmation
                            </Button>
                            {/* Only offered when there is something to do:
                                once every booking carries a place, this is
                                noise. */}
                            {unlinked.length > 0 && (
                                <Button onClick={linkUp} disabled={linking}>
                                    <GiPositionMarker /> {linking
                                        ? 'Looking them up…'
                                        : `Find ${unlinked.length} on Google`}
                                </Button>
                            )}
                            <Button variant="solid" onClick={book}>
                                <GiQuill /> Book a table
                            </Button>
                        </div>
                    }
                />
            )}

            {error && <p className="tablebook__error">{error}</p>}

            {/* Said plainly, including the half that did not work: a sweep
                that reports only its successes leaves her thinking the rest
                are done. */}
            {linked && (
                <p className="tablebook__linked" role="status">
                    {linked.found > 0
                        ? `Linked ${linked.found} ${linked.found === 1 ? 'booking' : 'bookings'} to Google.`
                        : 'Nothing could be matched with any confidence.'}
                    {linked.unsure > 0 && ` ${linked.unsure} ${linked.unsure === 1 ? 'was' : 'were'} too close to call — open ${linked.unsure === 1 ? 'it' : 'them'} and use @ to pick the right one.`}
                    <button type="button" onClick={() => setLinked(null)} aria-label="Dismiss">×</button>
                </p>
            )}

            <div className="tablebook__stats">
                <Stat
                    value={next ? countdown(next.starts_at) : '—'}
                    label={next ? (next.name || next.restaurant) : 'Nothing booked'}
                    icon={<GiClockwork />}
                />
                <Stat value={upcoming.length} label="On the books" icon={<GiForkKnifeSpoon />} />
                <Stat value={kept} label="Kept" icon={<GiCheckMark />} />
                <Stat value={letGo} label="Let go" icon={<GiWineGlass />} />
            </div>

            {/* "Refresh statuses" is gone. It promised the one thing it
                could not do — no booking service offers a way to ask whether
                a table you hold is still held — so it was a button that went
                away and came back with arithmetic over her own book, which is
                a strange thing to have to press. What it found that was worth
                finding is on the bookings themselves: the cancellation
                deadline is on the slip, and a table that has been and gone
                still has Went and Cancelled it sitting on it. */}

            <Tabs
                label="Table book"
                variant={embedded ? 'segmented' : 'underline'}
                active={tab}
                onChange={setTab}
                tabs={[
                    { id: 'held', label: 'On the books', count: upcoming.length },
                    { id: 'history', label: 'The full book', count: past.length },
                ]}
            />

            {loading ? <p className="muted">Reading your table book…</p> : (
                <>
                    <TabPanel id="held" active={tab}>
                        {upcoming.length === 0 ? (
                            <EmptyState
                                icon={<GiForkKnifeSpoon />}
                                message="No tables held."
                                hint="Book one above, or paste a confirmation email."
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
                                                    <h3 className="slip__name">
                                                        <span className="slip__face" title={labelOf(r)} aria-hidden="true">{faceOf(r)}</span>
                                                        {r.name || r.restaurant}
                                                    </h3>
                                                    <p className="slip__where">
                                                        <span aria-hidden="true"><GiPositionMarker /></span>
                                                        {r.maps_url ? (
                                                            <a href={r.maps_url} target="_blank" rel="noopener noreferrer">
                                                                {r.address || r.city || 'On the map'}
                                                            </a>
                                                        ) : (r.address || r.city)}
                                                        {[r.seating, r.party_size && `party of ${r.party_size}`]
                                                            .filter(Boolean).map((bit) => ` · ${bit}`)}
                                                        {r.rating != null && <span className="slip__rating">★ {r.rating}</span>}
                                                    </p>
                                                    <div className="slip__tags">
                                                        {r.platform && <Tag>{r.platform}</Tag>}
                                                        {r.confirmation && <Tag>#{r.confirmation}</Tag>}
                                                        {r.spot_id && <Tag>From your spots</Tag>}
                                                        {r.placed_where && <Tag>On {r.placed_where}</Tag>}
                                                    </div>
                                                    {r.cancel_by && (
                                                        <p className="slip__deadline">
                                                            Free to cancel until {fmtShort(r.cancel_by)}
                                                            {r.cancel_fee ? ` — after that it's ${r.cancel_fee}` : ''}
                                                        </p>
                                                    )}
                                                    {r.notes && <p className="slip__notes">{r.notes}</p>}
                                                </div>

                                                {/* A row, not a stack. Four buttons
                                                    stretched down a column made the card
                                                    as tall as the tallest thing on it and
                                                    left the icon-only delete stranded on a
                                                    line of its own. */}
                                                <div className="slip__actions">
                                                    {/* A booked table is a plan with a time on it.
                                                        It belongs on the day it happens, not only
                                                        in a list of bookings. */}
                                                    <AddBookingToDay
                                                        reservation={r}
                                                        onPlaced={() => refresh?.()}
                                                    />
                                                    <Button size="sm" onClick={() => markDined(r)}>
                                                        <GiCheckMark /> Went
                                                    </Button>
                                                    <Button size="sm" onClick={() => cancelReservation(r)}>
                                                        Cancelled it
                                                    </Button>
                                                </div>

                                                {/* Out of the row of things she does with a
                                                    booking and into the corner: it is the one
                                                    here that cannot be undone, and it was
                                                    sitting among them at the same weight. */}
                                                <ConfirmButton
                                                    className="slip__drop"
                                                    size="sm" icon
                                                    label={`Delete the ${r.name || r.restaurant} booking`}
                                                    onConfirm={() => deleteReservation(r.id)}
                                                >
                                                    <GiTrashCan />
                                                </ConfirmButton>
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
                                                    <strong>{r.name || r.restaurant}</strong>
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

                </>
            )}

            <Modal open={pasting} onClose={() => setPasting(false)} title="Paste a confirmation">
                <div className="tablebook__paste">
                    <p>
                        The whole email — subject line and all. It fills the booking form in;
                        nothing is saved until you press save.
                    </p>
                    <textarea
                        rows={12}
                        autoFocus
                        aria-label="The confirmation email"
                        placeholder="Your table at… is confirmed"
                        value={paste}
                        onChange={(e) => setPaste(e.target.value)}
                    />
                    {readError && <p className="tablebook__error">{readError}</p>}
                    <div className="tablebook__paste-acts">
                        <Button onClick={() => setPasting(false)}>Cancel</Button>
                        <Button
                            variant="solid"
                            disabled={paste.trim().length < 20 || reading}
                            onClick={readPaste}
                        >
                            {reading ? 'Reading…' : 'Read it'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Book something">
                <form className="tablebook__form" onSubmit={submit}>
                    {/* Type a name, or "@" it and pick the real place — which
                        brings its address, phone, map link and rating with it. */}
                    <Field label="What is booked">
                        <MentionInput
                            placeholder="Bosco   @ to find it"
                            aria-label="What is booked"
                            value={form.name}
                            near={form.city ? { city: form.city } : null}
                            onChange={(name) => setForm({ ...form, name })}
                            onPick={(place, text) => setForm({
                                ...form,
                                name: text.trim() || place.name,
                                address: place.address || '',
                                maps_url: place.maps_url || '',
                                place_id: place.place_id || '',
                                rating: place.rating ?? null,
                                city: form.city || '',
                            })}
                        />
                    </Field>
                    {/* Seven kinds, not seventy. A picker, not a taxonomy —
                        its only job is to let her find the thing later and
                        know at a glance what it is. */}
                    <div className="tablebook__kinds" role="radiogroup" aria-label="What kind of booking">
                        {KINDS.map((k) => (
                            <button
                                key={k.id}
                                type="button"
                                role="radio"
                                aria-checked={form.kind === k.id}
                                className={`tablebook__kind${form.kind === k.id ? ' is-on' : ''}`}
                                onClick={() => setForm({ ...form, kind: k.id })}
                            >
                                <span aria-hidden="true">{k.face}</span> {k.label}
                            </button>
                        ))}
                    </div>

                    {form.maps_url && (
                        <p className="tablebook__found">
                            <GiPositionMarker /> {form.address || 'Found on Google'}
                            <a href={form.maps_url} target="_blank" rel="noopener noreferrer">map</a>
                        </p>
                    )}
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
                            disabled={!form.name.trim() || !form.date || saving}
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
