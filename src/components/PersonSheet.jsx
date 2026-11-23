import React, { useMemo, useState } from 'react';
import { GiTrashCan } from 'react-icons/gi';
import { Button, ConfirmButton, Field, Modal, Tag } from './ui';
import {
    MONTHS, TOUCH_KINDS, CADENCES, RELATION_SUGGESTIONS, kindOf,
    birthdayLabel, nextBirthday, inDaysLabel, sinceLabel, linksFor, reverseOf,
    splitList, personFromForm, formFromPerson,
} from '../utils/people';
import { todayLocal } from '../utils/today';
import Avatar from './PersonAvatar';

/* ---------- the details form ---------- */

const CadenceSelect = (props) => (
    <select className="select" {...props}>
        {CADENCES.map((c) => <option key={c.days} value={c.days}>{c.label}</option>)}
    </select>
);


const DetailsForm = ({ initial, onSave, onCancel, saveLabel = 'Save' }) => {
    const [form, setForm] = useState(() => formFromPerson(initial));
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        const row = personFromForm(form);
        if (!row.name) { setErr('A name, at least.'); return; }
        setBusy(true);
        setErr(null);
        try {
            await onSave(row);
        } catch (ex) {
            setErr(ex.message || 'Could not save');
            setBusy(false);
        }
    };

    return (
        <form className="circle-form" onSubmit={submit}>
            <div className="circle-form__grid">
                <Field label="Name" value={form.name} onChange={set('name')} required autoFocus={!initial?.id} />
                <Field label="Goes by" value={form.nickname} onChange={set('nickname')} placeholder="Nickname" />
                <Field label="Who they are to you" value={form.relation} onChange={set('relation')}
                    placeholder="college friend, dad, Adeesh's cousin…" list="circle-relations" />
                <div className="field">
                    <span className="field__label">Birthday</span>
                    <div className="circle-form__bday">
                        <select className="select" aria-label="Birthday month" value={form.birthday_month} onChange={set('birthday_month')}>
                            <option value="">Month</option>
                            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                        <input className="input" aria-label="Birthday day" type="number" min="1" max="31"
                            placeholder="Day" value={form.birthday_day} onChange={set('birthday_day')} />
                        <input className="input" aria-label="Birth year" type="number" min="1900" max="2100"
                            placeholder="Year?" value={form.birth_year} onChange={set('birth_year')} />
                    </div>
                </div>
                <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
                <Field label="Email" type="email" value={form.email} onChange={set('email')} />
                <Field label="Address" as="textarea" rows={2} value={form.address} onChange={set('address')}
                    className="circle-form__wide" />
                <Field label="City" value={form.city} onChange={set('city')} />
                <Field label="Keep in touch" hint="Puts them at the top of Catch up once it's been this long.">
                    <CadenceSelect value={form.touch_every_days} onChange={set('touch_every_days')} />
                </Field>
                <Field label="How you met" value={form.how_we_met} onChange={set('how_we_met')}
                    className="circle-form__wide" />
                <Field label="Notes" as="textarea" rows={3} value={form.notes} onChange={set('notes')}
                    className="circle-form__wide" placeholder="Partner's name, kids, what's going on with them…" />
            </div>
            {err && <p className="circle__error" role="alert">{err}</p>}
            <div className="circle-form__actions">
                {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
                <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : saveLabel}</Button>
            </div>
        </form>
    );
};

/* ---------- read view ---------- */

const Facts = ({ person }) => {
    const rows = [
        ['Goes by', person.nickname],
        ['Birthday', birthdayLabel(person)],
        ['Phone', person.phone && <a href={`tel:${person.phone}`}>{person.phone}</a>],
        ['Email', person.email && <a href={`mailto:${person.email}`}>{person.email}</a>],
        ['Address', person.address && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(person.address)}`}
                target="_blank" rel="noopener noreferrer" className="circle-facts__address">{person.address}</a>
        )],
        ['City', person.city],
        ['How you met', person.how_we_met],
        ['Keep in touch', person.touch_every_days
            && (CADENCES.find((c) => c.days === String(person.touch_every_days))?.label
                || `Every ${person.touch_every_days} days`)],
    ].filter(([, v]) => v);
    return (
        <>
            {rows.length > 0 && (
                <dl className="circle-facts">
                    {rows.map(([k, v]) => (
                        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                    ))}
                </dl>
            )}
            {person.notes && <p className="circle-notes">{person.notes}</p>}
        </>
    );
};

/* ---------- likes ---------- */

const TagEditor = ({ label, values, onChange, placeholder }) => {
    const [draft, setDraft] = useState('');
    const add = (e) => {
        e.preventDefault();
        const more = splitList(draft).filter((v) => !values.some((x) => x.toLowerCase() === v.toLowerCase()));
        if (more.length) onChange([...values, ...more]);
        setDraft('');
    };
    return (
        <div className="circle-block">
            <h4>{label}</h4>
            {values.length > 0 && (
                <ul className="circle-tags">
                    {values.map((v) => (
                        <li key={v}>
                            <Tag>{v}
                                <button type="button" className="circle-tags__x" aria-label={`Remove ${v}`}
                                    onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
                            </Tag>
                        </li>
                    ))}
                </ul>
            )}
            <form className="circle-inline" onSubmit={add}>
                <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)}
                    placeholder={placeholder} aria-label={`Add to ${label}`} />
                <Button size="sm" type="submit" disabled={!draft.trim()}>Add</Button>
            </form>
        </div>
    );
};

/* ---------- gift ideas ---------- */

const GIFT_NEXT = { idea: 'bought', bought: 'given', given: 'idea' };
const GIFT_LABEL = { idea: 'Idea', bought: 'Bought', given: 'Given' };

const Gifts = ({ list, onAdd, onUpdate, onDelete }) => {
    const [idea, setIdea] = useState('');
    const [link, setLink] = useState('');
    const add = async (e) => {
        e.preventDefault();
        if (!idea.trim()) return;
        await onAdd({ idea: idea.trim(), link: link.trim() });
        setIdea('');
        setLink('');
    };
    const ordered = [...list].sort((a, b) => ['idea', 'bought', 'given'].indexOf(a.status)
        - ['idea', 'bought', 'given'].indexOf(b.status));
    return (
        <div className="circle-block">
            <h4>Gift ideas</h4>
            {ordered.length > 0 && (
                <ul className="circle-gifts">
                    {ordered.map((g) => (
                        <li key={g.id} className={`is-${g.status}`}>
                            <button type="button" className={`circle-gifts__state is-${g.status}`}
                                title="Idea → bought → given"
                                onClick={() => onUpdate(g.id, {
                                    status: GIFT_NEXT[g.status],
                                    given_on: GIFT_NEXT[g.status] === 'given' ? todayLocal() : g.given_on,
                                })}>
                                {GIFT_LABEL[g.status]}
                            </button>
                            <span className="circle-gifts__what">
                                {g.link
                                    ? <a href={g.link} target="_blank" rel="noopener noreferrer">{g.idea} ↗</a>
                                    : g.idea}
                                {g.status === 'given' && g.given_on && <em> · {g.given_on}</em>}
                            </span>
                            <button type="button" className="circle-x" aria-label={`Delete ${g.idea}`}
                                onClick={() => onDelete(g.id)}><GiTrashCan /></button>
                        </li>
                    ))}
                </ul>
            )}
            <form className="circle-inline" onSubmit={add}>
                <input className="input" value={idea} onChange={(e) => setIdea(e.target.value)}
                    placeholder="Something they'd love" aria-label="Gift idea" />
                <input className="input circle-inline__link" value={link} onChange={(e) => setLink(e.target.value)}
                    placeholder="Link (optional)" aria-label="Gift link" />
                <Button size="sm" type="submit" disabled={!idea.trim()}>Add</Button>
            </form>
        </div>
    );
};

/* ---------- connections ---------- */

const Connections = ({ person, circle, onOpen }) => {
    const { people, links, peopleById, addLink, deleteLink } = circle;
    const mine = useMemo(() => linksFor(person.id, links, peopleById), [person.id, links, peopleById]);
    const [otherId, setOtherId] = useState('');
    const [label, setLabel] = useState('');
    const [reverse, setReverse] = useState('');
    const [touchedReverse, setTouchedReverse] = useState(false);
    const others = people.filter((p) => p.id !== person.id);
    const other = peopleById.get(otherId);

    const add = async (e) => {
        e.preventDefault();
        if (!otherId || !label.trim()) return;
        const rev = touchedReverse ? reverse.trim() : (reverseOf(label) || '');
        // `label` is what the *other* person is to this one.
        await addLink(person.id, otherId, label.trim(), rev && rev !== label.trim() ? rev : null);
        setOtherId(''); setLabel(''); setReverse(''); setTouchedReverse(false);
    };

    return (
        <div className="circle-block">
            <h4>Connections</h4>
            {mine.length > 0 && (
                <ul className="circle-links">
                    {mine.map((l) => (
                        <li key={l.id}>
                            <button type="button" className="circle-links__who" onClick={() => onOpen(l.otherId)}>
                                <Avatar name={l.other.name} small />
                                <span><strong>{l.other.name}</strong> <em>{l.label}</em></span>
                            </button>
                            <button type="button" className="circle-x" aria-label={`Remove link to ${l.other.name}`}
                                onClick={() => deleteLink(l.id)}><GiTrashCan /></button>
                        </li>
                    ))}
                </ul>
            )}
            <form className="circle-link-form" onSubmit={add}>
                <select className="select" value={otherId} onChange={(e) => setOtherId(e.target.value)} aria-label="Who">
                    <option value="">Someone…</option>
                    {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span className="circle-link-form__is">is their</span>
                <input className="input" value={label} list="circle-relations" placeholder="sister, partner, friend…"
                    aria-label="Relation" onChange={(e) => {
                        setLabel(e.target.value);
                        if (!touchedReverse) setReverse(reverseOf(e.target.value) || '');
                    }} />
                <Button size="sm" type="submit" disabled={!otherId || !label.trim()}>Link</Button>
                {other && label.trim() && (
                    <label className="circle-link-form__reverse">
                        and {person.name.split(' ')[0]} is {other.name.split(' ')[0]}'s
                        <input className="input" value={reverse} placeholder={label.trim()}
                            onChange={(e) => { setReverse(e.target.value); setTouchedReverse(true); }} />
                    </label>
                )}
            </form>
        </div>
    );
};

/* ---------- in touch ---------- */

const InTouch = ({ person, circle, today }) => {
    const { touches, logTouch, deleteTouch } = circle;
    const [date, setDate] = useState(today);
    const [note, setNote] = useState('');
    const history = touches
        .filter((t) => t.person_id === person.id)
        .sort((a, b) => (b.happened_on).localeCompare(a.happened_on));

    const log = async (kind) => {
        await logTouch(person.id, { kind, happened_on: date, note: note.trim() });
        setNote('');
        setDate(today);
    };

    return (
        <div className="circle-block circle-touch">
            <h4>Log a catch-up</h4>
            <div className="circle-touch__row">
                <input className="input" type="date" value={date} max={today} aria-label="When"
                    onChange={(e) => setDate(e.target.value || today)} />
                <input className="input circle-touch__note" value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="What you did or talked about (optional)" aria-label="Note" />
            </div>
            <div className="circle-touch__kinds">
                {TOUCH_KINDS.filter((k) => k.id !== 'other').map((k) => (
                    <Button key={k.id} size="sm" onClick={() => log(k.id)}>{k.icon} {k.label}</Button>
                ))}
            </div>
            {history.length > 0 && (
                <ul className="circle-history">
                    {history.map((t) => (
                        <li key={t.id}>
                            <span className="circle-history__when">{t.happened_on}</span>
                            <span>{kindOf(t.kind).icon} {kindOf(t.kind).label}
                                {t.note && <em> · {t.note}</em>}
                                {t.source !== 'manual' && <Tag className="circle-history__src">{t.source}</Tag>}
                            </span>
                            <button type="button" className="circle-x" aria-label="Delete this catch-up"
                                onClick={() => deleteTouch(t.id)}><GiTrashCan /></button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const Relations = () => (
    <datalist id="circle-relations">
        {RELATION_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
    </datalist>
);

/* ---------- the sheet ---------- */

const PersonSheet = ({ personId, circle, onClose, onOpen }) => {
    const today = todayLocal();
    const {
        peopleById, lastBy, gifts, groups, members,
        addPerson, updatePerson, deletePerson,
        addGift, updateGift, deleteGift, toggleMember,
    } = circle;
    const person = personId === 'new' ? null : peopleById.get(personId);
    const [editing, setEditing] = useState(false);

    if (personId === 'new') {
        return (
            <Modal open onClose={onClose} title="Add someone" size="wide">
                <DetailsForm initial={{}} saveLabel="Add"
                    onSave={async (row) => { const p = await addPerson(row); onOpen(p.id); }}
                    onCancel={onClose} />
                <Relations />
            </Modal>
        );
    }
    if (!person) return null;

    const next = nextBirthday(person, today);
    const last = lastBy.get(person.id);
    const myGroups = new Set(members.filter((m) => m.person_id === person.id).map((m) => m.group_id));

    return (
        <Modal open onClose={onClose} size="wide" title={(
            <span className="circle-sheet__title">
                <Avatar name={person.name} />
                <span>
                    {person.name}
                    {person.relation && <small>{person.relation}</small>}
                </span>
            </span>
        )}>
            <div className="circle-sheet__glance">
                {next && (
                    <Tag tone={next.days <= 14 ? 'gold' : 'default'}>
                        🎂 {birthdayLabel(person)} · {inDaysLabel(next.days)}
                        {next.turning ? ` · turning ${next.turning}` : ''}
                    </Tag>
                )}
                <Tag tone={last ? 'default' : 'red'}>
                    Last in touch: {last ? `${sinceLabel(last.happened_on, today)} (${kindOf(last.kind).label.toLowerCase()})` : 'never logged'}
                </Tag>
            </div>

            <div className="circle-sheet__cols">
                <div className="circle-sheet__col">
                    <InTouch person={person} circle={circle} today={today} />

                    <div className="circle-block">
                        <div className="circle-block__head">
                            <h4>Details</h4>
                            {!editing && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>}
                        </div>
                        {editing ? (
                            <DetailsForm initial={person}
                                onSave={async (row) => { await updatePerson(person.id, row); setEditing(false); }}
                                onCancel={() => setEditing(false)} />
                        ) : (
                            <Facts person={person} />
                        )}
                    </div>
                </div>

                <div className="circle-sheet__col">
                    <TagEditor label="Likes" values={person.likes || []} placeholder="matcha, jazz, the Warriors…"
                        onChange={(likes) => updatePerson(person.id, { likes })} />
                    <TagEditor label="Not into" values={person.dislikes || []} placeholder="cilantro, surprises…"
                        onChange={(dislikes) => updatePerson(person.id, { dislikes })} />
                    <Gifts list={gifts.filter((g) => g.person_id === person.id)}
                        onAdd={(g) => addGift(person.id, g)} onUpdate={updateGift} onDelete={deleteGift} />

                    <div className="circle-block">
                        <h4>Groups</h4>
                        {groups.length === 0
                            ? <p className="muted">No groups yet. Make one on the Groups tab.</p>
                            : (
                                <div className="circle-chips">
                                    {groups.map((g) => (
                                        <button key={g.id} type="button"
                                            className={`circle-chip${myGroups.has(g.id) ? ' is-on' : ''}`}
                                            aria-pressed={myGroups.has(g.id)}
                                            onClick={() => toggleMember(g.id, person.id)}>
                                            {g.emoji ? `${g.emoji} ` : ''}{g.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                    </div>

                    <Connections person={person} circle={circle} onOpen={onOpen} />
                </div>
            </div>

            <footer className="circle-sheet__foot">
                <ConfirmButton label={`Delete ${person.name}`} confirmLabel="Delete for good?"
                    icon={<GiTrashCan />} onConfirm={async () => { await deletePerson(person.id); onClose(); }} />
            </footer>

            <Relations />
        </Modal>
    );
};

export default PersonSheet;
