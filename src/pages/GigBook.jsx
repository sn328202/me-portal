import React, { useState, useMemo } from 'react';
import {
    GiMicrophone, GiCheckMark, GiTrashCan, GiQuill, GiClockwork,
    GiMusicalNotes, GiArchiveResearch, GiEnvelope, GiTicket, GiReceiveMoney,
} from 'react-icons/gi';
import {
    Button, Card, PageHeader, Tabs, TabPanel, Modal, Field, Tag, Stat,
    ConfirmButton, EmptyState,
} from '../components/ui';
import { useGigs } from '../hooks/useGigs';
import { supabase } from '../lib/supabase';
import AddBookingToDay from '../components/AddBookingToDay';
import { GIG } from '../utils/placeable';
import {
    clockLabel, timeLabel, seatLabel, placeLabel, titleOf, ticketsLabel,
    totalsByCurrency, safeLink, SELLERS,
    BLANK_FORM, formFromParsed,
} from '../utils/gigs';
import { formatMoney } from '../utils/tripCosts';
import '../styles/BookingSlip.css';
import '../styles/GigBook.css';

const STATUS_LABEL = {
    booked: 'Booked', went: 'Went', cancelled: 'Cancelled', sold: 'Sold on', missed: 'Missed',
};

/* Dates only. A show's time is read from the printed digits, never through
   `Date`, so an 8pm show in another city stays 8pm. Noon keeps a daylight
   saving shift from moving the day. */
const asDay = (value) => new Date(`${String(value).slice(0, 10)}T12:00:00`);
const fmtDay = (value) => asDay(value).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
});
const fmtShort = (value) => asDay(value).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
});
const daysAway = (value) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const then = asDay(value); then.setHours(0, 0, 0, 0);
    return Math.round((then - start) / 86400000);
};
const countdown = (value) => {
    const d = daysAway(value);
    if (d < 0) return 'Passed';
    if (d === 0) return 'Tonight';
    if (d === 1) return 'Tomorrow';
    return `In ${d} days`;
};

/**
 * The Gig Book — concert tickets. The fourth room of the Atlas, next to the
 * Table Book and the Ticket Book, and built the same way: add one by hand or
 * paste the confirmation, and put it on a trip day when there is one.
 */
const GigBook = ({ embedded = false }) => {
    const {
        upcoming, past, gigs, loading, error,
        addGig, markWent, markSold, cancelGig, deleteGig, refresh,
    } = useGigs();

    const [tab, setTab] = useState('ahead');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState(BLANK_FORM);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const [pasting, setPasting] = useState(false);
    const [paste, setPaste] = useState('');
    const [reading, setReading] = useState(false);
    const [readError, setReadError] = useState(null);
    const [found, setFound] = useState([]);
    const [chosen, setChosen] = useState([]);
    const [dropped, setDropped] = useState(0);
    const [adding, setAdding] = useState(false);

    const went = useMemo(() => gigs.filter((g) => g.status === 'went').length, [gigs]);
    const paid = useMemo(() => totalsByCurrency(upcoming), [upcoming]);
    const paidLabel = paid.length
        ? paid.slice(0, 2).map((b) => formatMoney(b.total, b.currency)).join(' + ')
            + (paid.length > 2 ? ` +${paid.length - 2}` : '')
        : '—';

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.date || !form.name.trim() || saving) return;
        setSaving(true);
        setSaveError(null);
        try {
            await addGig(form);
            setForm(BLANK_FORM);
            setFormOpen(false);
        } catch (err) {
            console.error(err);
            setSaveError('That did not save. Try again.');
        } finally {
            setSaving(false);
        }
    };

    /** One show fills the form; several get a list to tick. Nothing saves itself. */
    const readPaste = async () => {
        const text = paste.trim();
        if (text.length < 20 || reading) return;
        setReading(true);
        setReadError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/gig-parse', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    Authorization: `Bearer ${session?.access_token || ''}`,
                },
                body: JSON.stringify({ text }),
            });
            const json = await res.json();
            if (!json.ok) { setReadError(json.error || 'Could not read that one.'); return; }

            const shows = json.gigs || [];
            setDropped(json.dropped || 0);
            if (shows.length === 1 && !json.dropped) {
                setForm(formFromParsed(shows[0]));
                setPaste('');
                setPasting(false);
                setSaveError(null);
                setFormOpen(true);
                return;
            }
            setFound(shows);
            setChosen(shows.map((_, i) => i));
        } catch (err) {
            console.error(err);
            setReadError('Could not read that one.');
        } finally {
            setReading(false);
        }
    };

    const toggle = (i) => setChosen((prev) => (
        prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i]
    ));

    const closePaste = () => {
        setPasting(false);
        setPaste('');
        setFound([]);
        setChosen([]);
        setDropped(0);
        setReadError(null);
    };

    const keepShows = async () => {
        if (adding || !chosen.length) return;
        setAdding(true);
        try {
            for (const show of found.filter((_, i) => chosen.includes(i))) {
                await addGig({ ...formFromParsed(show), source: 'paste' });
            }
            closePaste();
        } catch (err) {
            console.error(err);
            setReadError('Some of those did not save. Try again.');
        } finally {
            setAdding(false);
        }
    };

    const next = upcoming[0];
    const addOne = () => { setForm(BLANK_FORM); setSaveError(null); setFormOpen(true); };

    const acts = (
        <div className="gigbook__acts">
            <Button onClick={() => { setReadError(null); setPasting(true); }}>
                <GiEnvelope /> Paste a confirmation
            </Button>
            <Button variant="solid" onClick={addOne}><GiQuill /> Add a gig</Button>
        </div>
    );

    const subtitle = 'Concert tickets — who, where, which night and which seat. Held, gone to, and what each one cost.';

    return (
        <div className={`gigbook${embedded ? ' is-embedded' : ''}`}>
            {embedded ? (
                <header className="gigbook__head">
                    <div>
                        <h2 className="section-title"><GiMicrophone /> The Gig Book</h2>
                        <p>{subtitle}</p>
                    </div>
                    {acts}
                </header>
            ) : (
                <PageHeader title="The Gig Book" icon={<GiMicrophone />} subtitle={subtitle} actions={acts} />
            )}

            {error && <p className="gigbook__error">{error}</p>}

            <div className="gigbook__stats">
                <Stat
                    value={next ? countdown(next.starts) : '—'}
                    label={next ? titleOf(next) : 'Nothing booked'}
                    icon={<GiClockwork />}
                />
                <Stat value={upcoming.length} label="Coming up" icon={<GiTicket />} />
                <Stat value={went} label="Been to" icon={<GiCheckMark />} />
                <Stat value={paidLabel} label="Booked and paid" icon={<GiReceiveMoney />} />
            </div>

            <Tabs
                label="Gig book"
                variant={embedded ? 'segmented' : 'underline'}
                active={tab}
                onChange={setTab}
                tabs={[
                    { id: 'ahead', label: 'Coming up', icon: <GiMusicalNotes />, count: upcoming.length },
                    { id: 'history', label: 'Been to', icon: <GiArchiveResearch />, count: past.length },
                ]}
            />

            {loading ? <p className="muted">Reading your gig book…</p> : (
                <>
                    <TabPanel id="ahead" active={tab}>
                        {upcoming.length === 0 ? (
                            <EmptyState
                                icon={<GiMicrophone />}
                                message="No gigs booked."
                                hint="Add one above, or paste the confirmation email."
                            />
                        ) : (
                            <ul className="gigbook__slips">
                                {upcoming.map((g) => {
                                    const soon = daysAway(g.starts) <= 3;
                                    const where = placeLabel(g);
                                    const seat = seatLabel(g);
                                    const doors = timeLabel(g.doors);
                                    const link = safeLink(g.ticket_link);
                                    return (
                                        <li key={g.id}>
                                            <Card
                                                variant="flat"
                                                bodyClassName="slip__grid"
                                                className={`slip${soon ? ' slip--soon' : ''}`}
                                            >
                                                <div className="slip__when">
                                                    <span className="slip__day">{fmtDay(g.starts)}</span>
                                                    <span className="slip__time">{clockLabel(g.starts)}</span>
                                                    <span className="slip__count">{countdown(g.starts)}</span>
                                                </div>

                                                <div className="slip__body">
                                                    <h3 className="slip__name">
                                                        <span className="slip__face" aria-hidden="true">🎤</span>
                                                        {titleOf(g)}
                                                    </h3>
                                                    {g.support && <p className="slip__where">with {g.support}</p>}
                                                    {where && <p className="slip__where">{where}</p>}
                                                    {(doors || seat) && (
                                                        <p className="slip__where gigbook__seat">
                                                            {[doors ? `Doors ${doors}` : null, seat].filter(Boolean).join(' · ')}
                                                        </p>
                                                    )}

                                                    <div className="slip__tags">
                                                        {ticketsLabel(g) && <Tag>{ticketsLabel(g)}</Tag>}
                                                        {g.seller && <Tag>{g.seller}</Tag>}
                                                        {g.confirmation && <Tag>#{g.confirmation}</Tag>}
                                                        {g.cost != null && <Tag>{formatMoney(g.cost, g.currency || 'USD')}</Tag>}
                                                        {g.placed_where && <Tag>On {g.placed_where}</Tag>}
                                                    </div>

                                                    {link && (
                                                        <a className="gigbook__link" href={link} target="_blank" rel="noopener noreferrer">
                                                            Open the tickets ↗
                                                        </a>
                                                    )}
                                                    {g.notes && <p className="slip__notes">{g.notes}</p>}
                                                </div>

                                                <div className="slip__actions">
                                                    <AddBookingToDay reservation={g} spec={GIG} onPlaced={() => refresh?.()} />
                                                    <Button size="sm" onClick={() => markWent(g)}>
                                                        <GiCheckMark /> Went
                                                    </Button>
                                                    <Button size="sm" onClick={() => markSold(g)}>Sold them</Button>
                                                    <Button size="sm" onClick={() => cancelGig(g)}>Cancelled</Button>
                                                </div>

                                                <ConfirmButton
                                                    className="slip__drop"
                                                    size="sm" icon
                                                    label={`Delete the ${titleOf(g)} tickets`}
                                                    onConfirm={() => deleteGig(g.id)}
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
                            <EmptyState icon={<GiMicrophone />} message="None yet." />
                        ) : (
                            <div className="book-scroll">
                                <table className="ledger">
                                    <thead>
                                        <tr>
                                            <th scope="col">Date</th>
                                            <th scope="col">Who</th>
                                            <th scope="col">Where</th>
                                            <th scope="col">Seat</th>
                                            <th scope="col">Cost</th>
                                            <th scope="col">Outcome</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {past.map((g) => (
                                            <tr key={g.id}>
                                                <td className="ledger__date">{fmtShort(g.starts)}</td>
                                                <td>
                                                    <strong>{titleOf(g)}</strong>
                                                    {g.support && <span className="ledger__sub">with {g.support}</span>}
                                                </td>
                                                <td>{placeLabel(g) || '—'}</td>
                                                <td>{seatLabel(g) || '—'}</td>
                                                <td>{g.cost != null ? formatMoney(g.cost, g.currency || 'USD') : '—'}</td>
                                                <td>
                                                    <span className={`outcome outcome--${g.status}`}>
                                                        {STATUS_LABEL[g.status] || g.status}
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

            <Modal open={pasting} onClose={closePaste} title={found.length ? 'What it found' : 'Paste a confirmation'}>
                {found.length ? (
                    <div className="gigbook__paste">
                        <p>
                            {found.length === 1 ? 'One show' : `${found.length} shows`} on this order.
                            Untick anything you don’t want — nothing is saved until you press the button.
                        </p>
                        {dropped > 0 && (
                            <p className="gigbook__warn">
                                {dropped === 1 ? 'One more show was' : `${dropped} more shows were`} in there
                                without a date it could read. Add {dropped === 1 ? 'it' : 'them'} by hand if you need to.
                            </p>
                        )}
                        <ul className="gigbook__legs">
                            {found.map((show, i) => (
                                <li key={`${show.date}-${show.time}-${show.name}`}>
                                    <label className="gigbook__leg">
                                        <input type="checkbox" checked={chosen.includes(i)} onChange={() => toggle(i)} />
                                        <span className="gigbook__leg-face" aria-hidden="true">🎤</span>
                                        <span className="gigbook__leg-body">
                                            <strong>{show.name}</strong>
                                            <span className="gigbook__leg-day">
                                                {fmtDay(show.date)}
                                                {show.time ? ` · ${timeLabel(show.time)}` : ''}
                                                {show.venue ? ` · ${show.venue}` : ''}
                                                {seatLabel(show) ? ` · ${seatLabel(show)}` : ''}
                                            </span>
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                        {readError && <p className="gigbook__error">{readError}</p>}
                        <div className="gigbook__paste-acts">
                            <Button onClick={closePaste}>Cancel</Button>
                            <Button variant="solid" disabled={!chosen.length || adding} onClick={keepShows}>
                                {adding ? 'Writing them down…' : `Hold ${chosen.length} ${chosen.length === 1 ? 'gig' : 'gigs'}`}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="gigbook__paste">
                        <p>
                            The whole confirmation from Ticketmaster, AXS, Dice or the venue. Nothing is
                            saved until you say so.
                        </p>
                        <textarea
                            rows={12}
                            autoFocus
                            aria-label="The confirmation email"
                            placeholder="You're in! Your order for…"
                            value={paste}
                            onChange={(e) => setPaste(e.target.value)}
                        />
                        {readError && <p className="gigbook__error">{readError}</p>}
                        <div className="gigbook__paste-acts">
                            <Button onClick={closePaste}>Cancel</Button>
                            <Button variant="solid" disabled={paste.trim().length < 20 || reading} onClick={readPaste}>
                                {reading ? 'Reading…' : 'Read it'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add a gig">
                <form className="gigbook__form" onSubmit={submit}>
                    <Field label="Who" placeholder="Phoebe Bridgers" value={form.name} onChange={set('name')} required />
                    <Field label="With" placeholder="Support acts" value={form.support} onChange={set('support')} />
                    <Field label="Venue" placeholder="The Fillmore" value={form.venue} onChange={set('venue')} />
                    <Field label="City" placeholder="San Francisco" value={form.city} onChange={set('city')} />
                    <Field label="Date" type="date" value={form.date} onChange={set('date')} required />
                    <Field label="Show starts" type="time" value={form.time} onChange={set('time')} hint="The venue's clock" />
                    <Field label="Doors" type="time" value={form.doors} onChange={set('doors')} hint="The day card starts here if set" />
                    <Field label="Tickets" type="number" min="1" step="1" placeholder="2" value={form.tickets} onChange={set('tickets')} />
                    <Field label="Section" placeholder="104 or GA Floor" value={form.section} onChange={set('section')} />
                    <Field label="Row" placeholder="F" value={form.row} onChange={set('row')} />
                    <Field label="Seat" placeholder="12-13" value={form.seat} onChange={set('seat')} />
                    <Field label="Confirmation" placeholder="Order 12-34567/SFO" value={form.confirmation} onChange={set('confirmation')} />
                    <Field label="Cost" type="number" min="0" step="0.01" placeholder="148.50" hint="Total, with fees" value={form.cost} onChange={set('cost')} />
                    <Field
                        label="Currency"
                        placeholder="USD"
                        value={form.currency}
                        onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    />
                    <Field label="Bought from" placeholder="Ticketmaster" list="gigbook-sellers" value={form.seller} onChange={set('seller')} />
                    <Field label="Ticket link" type="url" placeholder="https://…" value={form.ticket_link} onChange={set('ticket_link')} />
                    <datalist id="gigbook-sellers">
                        {SELLERS.map((s) => <option key={s} value={s} />)}
                    </datalist>
                    <Field
                        label="Anything to remember"
                        as="textarea"
                        rows={2}
                        placeholder="Mobile tickets in the app. Clear bag only."
                        value={form.notes}
                        onChange={set('notes')}
                        className="gigbook__form-wide"
                    />
                    {saveError && <p className="gigbook__error gigbook__form-wide">{saveError}</p>}
                    <div className="gigbook__form-actions">
                        <Button type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="solid" disabled={!form.date || !form.name.trim() || saving}>
                            {saving ? 'Writing it down…' : 'Hold the tickets'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default GigBook;
