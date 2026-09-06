import React, { useState, useMemo } from 'react';
import {
    GiCommercialAirplane, GiCheckMark, GiTrashCan, GiQuill,
    GiClockwork, GiPathDistance, GiArchiveResearch, GiSuitcase,
} from 'react-icons/gi';
import {
    Button, Card, PageHeader, Tabs, TabPanel, Modal, Field, Tag, Stat,
    ConfirmButton, EmptyState,
} from '../components/ui';
import { useJourneys } from '../hooks/useJourneys';
import AddBookingToDay from '../components/AddBookingToDay';
import { JOURNEY } from '../utils/placeable';
import {
    MODES, faceOf, labelOf, guessMode, routeLabel, serviceLabel,
    clockLabel, clockSpanLabel, crossesMidnight, drawsAsBlock,
    localDate, titleOf, totalsByCurrency,
} from '../utils/journeys';
import { formatMoney } from '../utils/tripCosts';
import '../styles/BookingSlip.css';
import '../styles/TicketBook.css';

const EMPTY_FORM = {
    mode: 'flight', carrier: '', number: '',
    from_place: '', to_place: '',
    date: '', time: '09:00', arrive_date: '', arrive_time: '',
    confirmation: '', duration: '', cost: '', currency: 'USD', baggage: '', notes: '',
};

const STATUS_LABEL = {
    booked: 'Booked', travelled: 'Travelled', cancelled: 'Cancelled', missed: 'Missed',
};

/* Dates only — a ticket's *time* never goes through `Date`, because building
   one re-applies the reader's own zone and turns a 6pm New York arrival back
   into whatever 6pm New York is where she happens to be sitting. `clockLabel`
   reads the printed time instead. Noon is used to build the date so a daylight
   saving shift cannot round the day itself off by one. */
const asDay = (value) => new Date(`${String(value).slice(0, 10)}T12:00:00`);

const fmtDay = (value) => asDay(value).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
});
const fmtShort = (value) => asDay(value).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
});

/** Whole days from now, so "tomorrow" reads as tomorrow all day. */
const daysAway = (value) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const then = asDay(value); then.setHours(0, 0, 0, 0);
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
 * The Ticket Book — how she gets there.
 *
 * A sibling of the Table Book rather than a tab inside it. The two hold the
 * same kind of thing — something you can lose by not turning up — and draw the
 * same slip, which is why the slip is now its own stylesheet. What they do not
 * share is a shape: a table has a party size and a booking platform, a journey
 * has two places, two clocks and a number that means something to a departure
 * board, and cramming the second into the first would have meant eight columns
 * that are null for every restaurant she has ever booked.
 *
 * Deliberately not built around a `name`. A journey's identity is its route,
 * and a field she has to fill in with "flight to Bombay" having already said
 * LHR and BOM is a field that will disagree with them by next Tuesday.
 */
const TicketBook = ({ embedded = false }) => {
    const {
        upcoming, past, journeys, loading, error,
        addJourney, markTravelled, cancelJourney, deleteJourney, refresh,
    } = useJourneys();

    const [tab, setTab] = useState('held');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const travelled = useMemo(
        () => journeys.filter((j) => j.status === 'travelled').length, [journeys]
    );
    /* Kept per currency rather than summed into one. A Eurostar ticket in
       pounds added to a flight in dollars gives a figure that looks like a
       total and is not one, and no exchange rate is fetched to paper over it:
       both are shown. */
    const paid = useMemo(() => totalsByCurrency(upcoming), [upcoming]);
    const currency = useMemo(
        () => upcoming.find((j) => j.currency)?.currency || 'USD', [upcoming]
    );
    const paidLabel = paid.length
        ? paid.slice(0, 2).map((b) => formatMoney(b.total, b.currency)).join(' + ')
            + (paid.length > 2 ? ` +${paid.length - 2}` : '')
        : '—';

    /* Both ends written down exactly as the form has them — no `Date`, no
       `toISOString`, nothing that would stamp a zone onto a clock that belongs
       to somewhere else. `2026-09-16T18:00:00` means six in the evening where
       she lands, and Postgres stores that and nothing more.

       An arrival with no date of its own is the same day as the departure,
       which is true of most journeys and is the only reading that lets her
       leave the second date box alone. */
    const stamp = (day, time) => (day && time ? `${day}T${time.slice(0, 5)}:00` : null);
    const arrivesAt = () => stamp(form.arrive_date || form.date, form.arrive_time);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.date || saving) return;
        setSaving(true);
        try {
            await addJourney({
                mode: form.mode,
                carrier: form.carrier.trim() || null,
                number: form.number.trim() || null,
                from_place: form.from_place.trim() || null,
                to_place: form.to_place.trim() || null,
                departs: stamp(form.date, form.time || '09:00'),
                arrives: arrivesAt(),
                duration: form.duration.trim() || null,
                confirmation: form.confirmation.trim() || null,
                cost: form.cost,
                currency: form.cost ? form.currency : null,
                baggage: form.baggage.trim() || null,
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

    const next = upcoming[0];
    const bookOne = () => { setForm(EMPTY_FORM); setFormOpen(true); };

    /* Typing the carrier is usually enough to know what it is. A wrong guess
       is one click to fix, and she can always click a mode herself first —
       which is why this only fires while the mode is still the default. */
    const carrierTyped = (carrier) => setForm((f) => ({
        ...f,
        carrier,
        mode: f.mode === 'flight' ? guessMode(`${carrier} ${f.number}`) : f.mode,
    }));

    const acts = (
        <div className="ticketbook__acts">
            <Button variant="solid" onClick={bookOne}><GiQuill /> Add a journey</Button>
        </div>
    );

    return (
        <div className={`ticketbook${embedded ? ' is-embedded' : ''}`}>
            {embedded ? (
                <header className="ticketbook__head">
                    <div>
                        <h2 className="section-title"><GiCommercialAirplane /> The Ticket Book</h2>
                        <p>Every way there — flights, trains, ferries and coaches. Held, taken, and what each one cost.</p>
                    </div>
                    {acts}
                </header>
            ) : (
                <PageHeader
                    title="The Ticket Book"
                    icon={<GiCommercialAirplane />}
                    subtitle="Every way there — flights, trains, ferries and coaches. Held, taken, and what each one cost."
                    actions={acts}
                />
            )}

            {error && <p className="ticketbook__error">{error}</p>}

            <div className="ticketbook__stats">
                <Stat
                    value={next ? countdown(next.departs) : '—'}
                    label={next ? (routeLabel(next) || labelOf(next)) : 'Nothing booked'}
                    icon={<GiClockwork />}
                />
                <Stat value={upcoming.length} label="Ahead of you" icon={<GiCommercialAirplane />} />
                <Stat value={travelled} label="Travelled" icon={<GiCheckMark />} />
                <Stat
                    value={paidLabel}
                    label="Booked and paid"
                    icon={<GiSuitcase />}
                />
            </div>

            <Tabs
                label="Ticket book"
                variant={embedded ? 'segmented' : 'underline'}
                active={tab}
                onChange={setTab}
                tabs={[
                    { id: 'held', label: 'Ahead of you', icon: <GiPathDistance />, count: upcoming.length },
                    { id: 'history', label: 'Everywhere been', icon: <GiArchiveResearch />, count: past.length },
                ]}
            />

            {loading ? <p className="muted">Reading your ticket book…</p> : (
                <>
                    <TabPanel id="held" active={tab}>
                        {upcoming.length === 0 ? (
                            <EmptyState
                                icon={<GiCommercialAirplane />}
                                message="Nothing booked to anywhere."
                                hint="Add a flight, a train or a ferry above."
                            />
                        ) : (
                            <ul className="ticketbook__slips">
                                {upcoming.map((j) => {
                                    const soon = daysAway(j.departs) <= 3;
                                    return (
                                        <li key={j.id}>
                                            <Card
                                                variant="flat"
                                                bodyClassName="slip__grid"
                                                className={`slip${soon ? ' slip--soon' : ''}`}
                                            >
                                                <div className="slip__when">
                                                    <span className="slip__day">{fmtDay(j.departs)}</span>
                                                    <span className="slip__time">{clockLabel(j.departs)}</span>
                                                    <span className="slip__count">{countdown(j.departs)}</span>
                                                </div>

                                                <div className="slip__body">
                                                    <h3 className="slip__name">
                                                        <span className="slip__face" title={labelOf(j)} aria-hidden="true">{faceOf(j)}</span>
                                                        {routeLabel(j) || labelOf(j)}
                                                    </h3>

                                                    {/* The two clocks, said once. An arrival is
                                                        the thing you plan the evening around, so
                                                        it earns a line rather than a tag. */}
                                                    {j.arrives && (
                                                        <p className="slip__where ticketbook__arrive">
                                                            Lands {clockLabel(j.arrives)}
                                                            {crossesMidnight(j) && (
                                                                <em className="ticketbook__overnight"> next day</em>
                                                            )}
                                                            {/* Said out loud, because it is the whole
                                                                point: this is the clock where she gets
                                                                off, not the clock she left on. */}
                                                            <span className="ticketbook__local"> local</span>
                                                            {/* The ticket's own flying time when she
                                                                copied it across. Never subtracted from
                                                                the two clocks — SF 9am to NYC 6pm is a
                                                                six-hour flight and a nine-hour span,
                                                                and only one of those is on the ticket. */}
                                                            {j.duration ? ` · ${j.duration}` : ''}
                                                        </p>
                                                    )}

                                                    <div className="slip__tags">
                                                        {serviceLabel(j) && <Tag>{serviceLabel(j)}</Tag>}
                                                        {j.confirmation && <Tag>#{j.confirmation}</Tag>}
                                                        {j.cost != null && (
                                                            <Tag>{formatMoney(j.cost, j.currency || currency)}</Tag>
                                                        )}
                                                        {j.placed_where && <Tag>On {j.placed_where}</Tag>}
                                                    </div>

                                                    {j.baggage && (
                                                        <p className="slip__deadline">
                                                            <GiSuitcase aria-hidden="true" /> {j.baggage}
                                                        </p>
                                                    )}
                                                    {j.notes && <p className="slip__notes">{j.notes}</p>}
                                                </div>

                                                <div className="slip__actions">
                                                    {/* A booked journey is a plan with a time on
                                                        it. It belongs on the day it happens, not
                                                        only in a list of tickets. */}
                                                    <AddBookingToDay
                                                        reservation={j}
                                                        spec={JOURNEY}
                                                        onPlaced={() => refresh?.()}
                                                    />
                                                    <Button size="sm" onClick={() => markTravelled(j)}>
                                                        <GiCheckMark /> Travelled
                                                    </Button>
                                                    <Button size="sm" onClick={() => cancelJourney(j)}>
                                                        Cancelled it
                                                    </Button>
                                                </div>

                                                <ConfirmButton
                                                    className="slip__drop"
                                                    size="sm" icon
                                                    label={`Delete the ${titleOf(j)} booking`}
                                                    onConfirm={() => deleteJourney(j.id)}
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
                            <EmptyState icon={<GiCommercialAirplane />} message="Nowhere yet." />
                        ) : (
                            <div className="book-scroll">
                                <table className="ledger">
                                    <thead>
                                        <tr>
                                            <th scope="col">Date</th>
                                            <th scope="col">Route</th>
                                            <th scope="col">Service</th>
                                            <th scope="col">Off the day</th>
                                            <th scope="col">Cost</th>
                                            <th scope="col">Outcome</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {past.map((j) => (
                                            <tr key={j.id}>
                                                <td className="ledger__date">{fmtShort(j.departs)}</td>
                                                <td>
                                                    <strong>{routeLabel(j) || labelOf(j)}</strong>
                                                    {j.notes && <span className="ledger__sub">{j.notes}</span>}
                                                </td>
                                                <td className="ledger__plat">
                                                    <span aria-hidden="true">{faceOf(j)}</span> {serviceLabel(j) || labelOf(j)}
                                                </td>
                                                <td title="Clock to clock, not flying time">
                                                    {j.duration || clockSpanLabel(j) || '—'}
                                                </td>
                                                <td>{j.cost != null ? formatMoney(j.cost, j.currency || currency) : '—'}</td>
                                                <td>
                                                    <span className={`outcome outcome--${j.status}`}>
                                                        {STATUS_LABEL[j.status] || j.status}
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

            <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add a journey">
                <form className="ticketbook__form" onSubmit={submit}>
                    <div className="ticketbook__modes" role="radiogroup" aria-label="How you are getting there">
                        {MODES.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                role="radio"
                                aria-checked={form.mode === m.id}
                                className={`ticketbook__mode${form.mode === m.id ? ' is-on' : ''}`}
                                onClick={() => setForm({ ...form, mode: m.id })}
                            >
                                <span aria-hidden="true">{m.face}</span> {m.label}
                            </button>
                        ))}
                    </div>

                    <Field
                        label="From"
                        placeholder="LHR"
                        value={form.from_place}
                        onChange={(e) => setForm({ ...form, from_place: e.target.value })}
                    />
                    <Field
                        label="To"
                        placeholder="BOM"
                        value={form.to_place}
                        onChange={(e) => setForm({ ...form, to_place: e.target.value })}
                    />
                    <Field
                        label="Carrier"
                        placeholder="British Airways"
                        value={form.carrier}
                        onChange={(e) => carrierTyped(e.target.value)}
                    />
                    <Field
                        label="Flight or train number"
                        placeholder="BA 286"
                        value={form.number}
                        onChange={(e) => setForm({ ...form, number: e.target.value })}
                    />
                    <Field
                        label="Departs"
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                    <Field
                        label="At"
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                    />
                    <Field
                        label="Lands"
                        type="time"
                        value={form.arrive_time}
                        hint="The clock where you land, straight off the ticket"
                        onChange={(e) => setForm({ ...form, arrive_time: e.target.value })}
                    />
                    <Field
                        label="On a later day"
                        type="date"
                        value={form.arrive_date}
                        hint="Only for a red-eye"
                        onChange={(e) => setForm({ ...form, arrive_date: e.target.value })}
                    />
                    {/* Said before she saves rather than discovered on the
                        timeline afterwards. */}
                    {form.arrive_time && form.date && !drawsAsBlock({
                        departs: stamp(form.date, form.time), arrives: arrivesAt(),
                    }) && (
                        <p className="ticketbook__warn">
                            {localDate(arrivesAt()) > form.date
                                ? 'Lands the next day — it will sit on the departure day as a start time, with the landing in the note.'
                                : 'That lands at or before it leaves on the same date. If it is a red-eye, give it the arrival date; if it crosses the date line westward, leave it — the landing goes in the note.'}
                        </p>
                    )}
                    <Field
                        label="Confirmation"
                        placeholder="XQ7R2P"
                        value={form.confirmation}
                        onChange={(e) => setForm({ ...form, confirmation: e.target.value })}
                    />
                    <Field
                        label="Cost"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="486.20"
                        value={form.cost}
                        onChange={(e) => setForm({ ...form, cost: e.target.value })}
                    />
                    <Field
                        label="Baggage"
                        placeholder="1 checked 23kg + cabin"
                        value={form.baggage}
                        onChange={(e) => setForm({ ...form, baggage: e.target.value })}
                    />
                    <Field
                        label="Currency"
                        placeholder="USD"
                        value={form.currency}
                        onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                    />
                    <Field
                        label="Anything to remember"
                        as="textarea"
                        rows={2}
                        placeholder="Seat 14A. Check in opens 24h before. Terminal 5."
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className="ticketbook__form-wide"
                    />
                    <div className="ticketbook__form-actions">
                        <Button type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="solid" disabled={!form.date || saving}>
                            {saving ? 'Writing it down…' : 'Hold the ticket'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default TicketBook;
