import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GiThreeFriends, GiCupcake, GiTalk, GiFamilyTree } from 'react-icons/gi';
import { Button, Card, ConfirmButton, PageHeader, Tabs, Tag, EmptyState } from '../components/ui';
import PersonSheet from '../components/PersonSheet';
import Avatar from '../components/PersonAvatar';
import { usePeople } from '../hooks/usePeople';
import {
    TOUCH_KINDS, kindOf, birthdayLabel, nextBirthday, inDaysLabel, sinceLabel,
    upcomingBirthdays, birthdaysByMonth, catchUpList, linksWithin, matchesSearch,
} from '../utils/people';
import { todayLocal } from '../utils/today';
import '../styles/People.css';

/**
 * The Circle: the people in her life and how they fit into it.
 *
 * Contacts already has names and numbers. This keeps what Contacts doesn't:
 * what someone likes, what to get them, when she last actually saw or spoke
 * to them, who they are to each other, and which crowd they're part of.
 *
 * Four ways in, as tabs: everyone (filterable to one group at a time), the
 * birthday year, who's due a catch-up, and the groups themselves.
 */

const TABS = [
    { id: 'everyone', label: 'Everyone', icon: <GiThreeFriends /> },
    { id: 'birthdays', label: 'Birthdays', icon: <GiCupcake /> },
    { id: 'catchup', label: 'Catch up', icon: <GiTalk /> },
    { id: 'groups', label: 'Groups', icon: <GiFamilyTree /> },
];
const NO_GROUP = '__none';

/** One person as a row in a list. */
const PersonRow = ({ person, today, last, groups, onOpen, aside }) => {
    const next = nextBirthday(person, today);
    return (
        <li className="circle-row">
            <button type="button" className="circle-row__main" onClick={() => onOpen(person.id)}>
                <Avatar name={person.name} />
                <span className="circle-row__text">
                    <strong>{person.name}</strong>
                    <em>
                        {[person.relation, person.city].filter(Boolean).join(' · ')}
                        {groups?.length > 0 && (
                            <span className="circle-row__groups">
                                {groups.map((g) => <Tag key={g.id}>{g.emoji ? `${g.emoji} ` : ''}{g.name}</Tag>)}
                            </span>
                        )}
                    </em>
                </span>
                <span className="circle-row__meta">
                    {next && (
                        <span className={next.days <= 14 ? 'is-soon' : ''}>
                            🎂 {birthdayLabel(person)}{next.days <= 30 ? ` · ${inDaysLabel(next.days)}` : ''}
                        </span>
                    )}
                    <span className={last ? '' : 'is-never'}>
                        {last ? `${kindOf(last.kind).icon} ${sinceLabel(last.happened_on, today)}` : 'not logged'}
                    </span>
                </span>
            </button>
            {aside}
        </li>
    );
};

const People = () => {
    const circle = usePeople();
    const {
        people, groups, members, links, lastBy, groupsOf, peopleById,
        loading, error, addGroup, updateGroup, deleteGroup, logTouch,
    } = circle;
    const [params, setParams] = useSearchParams();
    const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'everyone';
    const groupFilter = params.get('group') || '';
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(null);
    const today = todayLocal();

    const go = (next) => setParams((prev) => {
        const p = new URLSearchParams(prev);
        Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
        return p;
    }, { replace: true });

    const soon = useMemo(() => upcomingBirthdays(people, today, 30), [people, today]);

    const filtered = useMemo(() => {
        let list = people.filter((p) => matchesSearch(p, query));
        if (groupFilter === NO_GROUP) list = list.filter((p) => !groupsOf.get(p.id)?.length);
        else if (groupFilter) {
            const ids = new Set(members.filter((m) => m.group_id === groupFilter).map((m) => m.person_id));
            list = list.filter((p) => ids.has(p.id));
        }
        return list;
    }, [people, query, groupFilter, members, groupsOf]);

    const activeGroup = groups.find((g) => g.id === groupFilter);
    const groupLinks = useMemo(
        () => (activeGroup ? linksWithin(filtered.map((p) => p.id), links) : []),
        [activeGroup, filtered, links],
    );

    const tabs = TABS.map((t) => ({ ...t, count: t.id === 'everyone' ? people.length : t.id === 'groups' ? groups.length : undefined }));

    return (
        <div className="page circle">
            <PageHeader
                title="The Circle"
                icon={<GiThreeFriends />}
                subtitle="Who's who, what they love, and when you last caught up."
                actions={<Button variant="primary" onClick={() => setOpen('new')}>+ Add someone</Button>}
            />

            {error && <p className="circle__error" role="alert">{error}</p>}

            {soon.length > 0 && (
                <Card variant="flat" className="circle-soon" title="Birthdays in the next 30 days" icon={<GiCupcake />}>
                    <ul className="circle-soon__list">
                        {soon.map(({ person, next }) => (
                            <li key={person.id}>
                                <button type="button" onClick={() => setOpen(person.id)}
                                    className={next.days <= 7 ? 'is-soon' : ''}>
                                    <strong>{person.name}</strong>
                                    <span>{birthdayLabel(person)} · {inDaysLabel(next.days)}
                                        {next.turning ? ` · ${next.turning}` : ''}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            <Tabs tabs={tabs} active={tab} onChange={(id) => go({ tab: id === 'everyone' ? '' : id })} label="The Circle" />

            {loading ? (
                <p className="muted">Gathering everyone…</p>
            ) : tab === 'everyone' ? (
                <section className="circle-everyone">
                    <div className="circle-filters">
                        <input className="input circle-search" type="search" value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search names, cities, likes…" aria-label="Search people" />
                        <div className="circle-chips" role="group" aria-label="Show one group">
                            <button type="button" className={`circle-chip${!groupFilter ? ' is-on' : ''}`}
                                onClick={() => go({ group: '' })}>All</button>
                            {groups.map((g) => (
                                <button key={g.id} type="button"
                                    className={`circle-chip${groupFilter === g.id ? ' is-on' : ''}`}
                                    onClick={() => go({ group: g.id })}>
                                    {g.emoji ? `${g.emoji} ` : ''}{g.name}
                                </button>
                            ))}
                            {groups.length > 0 && (
                                <button type="button" className={`circle-chip${groupFilter === NO_GROUP ? ' is-on' : ''}`}
                                    onClick={() => go({ group: NO_GROUP })}>No group</button>
                            )}
                        </div>
                    </div>

                    {activeGroup && (activeGroup.notes || groupLinks.length > 0) && (
                        <Card variant="flat" className="circle-groupnote">
                            {activeGroup.notes && <p>{activeGroup.notes}</p>}
                            {groupLinks.length > 0 && (
                                <p className="circle-groupnote__links">
                                    {groupLinks.map((l) => (
                                        <span key={l.id}>
                                            {peopleById.get(l.person_b)?.name} is {peopleById.get(l.person_a)?.name.split(' ')[0]}'s {l.label}
                                        </span>
                                    ))}
                                </p>
                            )}
                        </Card>
                    )}

                    {filtered.length === 0 ? (
                        <EmptyState icon={<GiThreeFriends />}
                            message={people.length ? 'Nobody matches that.' : 'Nobody here yet.'}
                            actionLabel={people.length ? undefined : 'Add someone'}
                            onAction={() => setOpen('new')} />
                    ) : (
                        <ul className="circle-list">
                            {filtered.map((p) => (
                                <PersonRow key={p.id} person={p} today={today} last={lastBy.get(p.id)}
                                    groups={groupFilter ? null : groupsOf.get(p.id)} onOpen={setOpen} />
                            ))}
                        </ul>
                    )}
                </section>
            ) : tab === 'birthdays' ? (
                <BirthdayYear people={people} today={today} onOpen={setOpen} />
            ) : tab === 'catchup' ? (
                <CatchUp people={people} lastBy={lastBy} today={today} onOpen={setOpen} logTouch={logTouch} />
            ) : (
                <Groups groups={groups} members={members} peopleById={peopleById}
                    addGroup={addGroup} updateGroup={updateGroup} deleteGroup={deleteGroup}
                    onShow={(id) => go({ tab: '', group: id })} />
            )}

            {open && (
                <PersonSheet key={open} personId={open} circle={circle}
                    onClose={() => setOpen(null)} onOpen={setOpen} />
            )}
        </div>
    );
};

/* ---------- Birthdays: the year, month by month ---------- */

const BirthdayYear = ({ people, today, onOpen }) => {
    const months = birthdaysByMonth(people, today);
    const missing = people.filter((p) => !p.birthday_month);
    return (
        <section className="circle-year">
            {months.map((m) => (
                <Card key={m.month} variant="flat" className="circle-month" title={m.name}>
                    {m.people.length === 0 ? <p className="muted">—</p> : (
                        <ul>
                            {m.people.map((p) => {
                                const next = nextBirthday(p, today);
                                return (
                                    <li key={p.id}>
                                        <button type="button" onClick={() => onOpen(p.id)}
                                            className={next.days <= 14 ? 'is-soon' : ''}>
                                            <span className="circle-month__day">{p.birthday_day}</span>
                                            <span>{p.name}</span>
                                            {next.turning && <em>{next.turning}</em>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
            ))}
            {missing.length > 0 && (
                <Card variant="flat" className="circle-month circle-month--missing" title="No birthday yet">
                    <ul>
                        {missing.map((p) => (
                            <li key={p.id}><button type="button" onClick={() => onOpen(p.id)}>{p.name}</button></li>
                        ))}
                    </ul>
                </Card>
            )}
        </section>
    );
};

/* ---------- Catch up ---------- */

const CatchUp = ({ people, lastBy, today, onOpen, logTouch }) => {
    const rows = catchUpList(people, lastBy, today);
    const [onlyLogged, setOnlyLogged] = useState(false);
    const shown = onlyLogged ? rows.filter((r) => r.last || r.overdue) : rows;
    return (
        <section>
            <p className="circle-hint">
                Overdue first (anyone with a “keep in touch” gap that’s run out), then everyone you’ve logged,
                longest since first. Tap a button to log a catch-up for today.
            </p>
            <label className="circle-toggle">
                <input type="checkbox" checked={onlyLogged} onChange={(e) => setOnlyLogged(e.target.checked)} />
                Hide people with nothing logged
            </label>
            <ul className="circle-list">
                {shown.map((r) => (
                    <PersonRow key={r.person.id} person={r.person} today={today} last={r.last} onOpen={onOpen}
                        aside={(
                            <span className="circle-row__aside">
                                {r.overdue && <Tag tone="red">overdue</Tag>}
                                {TOUCH_KINDS.filter((k) => ['in_person', 'call', 'text'].includes(k.id)).map((k) => (
                                    <Button key={k.id} size="sm" variant="ghost" icon label={`${k.label} today`}
                                        onClick={() => logTouch(r.person.id, { kind: k.id })}>{k.icon}</Button>
                                ))}
                            </span>
                        )} />
                ))}
            </ul>
        </section>
    );
};

/* ---------- Groups ---------- */

const Groups = ({ groups, members, peopleById, addGroup, updateGroup, deleteGroup, onShow }) => {
    const [name, setName] = useState('');
    const [emoji, setEmoji] = useState('');
    const [err, setErr] = useState(null);
    const add = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        try {
            await addGroup({ name: name.trim(), emoji: emoji.trim() });
            setName(''); setEmoji(''); setErr(null);
        } catch (ex) {
            setErr(ex.code === '23505' ? 'There’s already a group with that name.' : ex.message);
        }
    };
    return (
        <section className="circle-groups">
            <form className="circle-inline circle-groups__new" onSubmit={add}>
                <input className="input circle-groups__emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)}
                    placeholder="🙂" aria-label="Emoji" maxLength={4} />
                <input className="input" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="New group: college crew, book club, the cousins…" aria-label="Group name" />
                <Button type="submit" disabled={!name.trim()}>Make group</Button>
            </form>
            {err && <p className="circle__error" role="alert">{err}</p>}
            <p className="circle-hint">Add people to a group from their page. Open a group to see just them.</p>
            <div className="circle-groups__grid">
                {groups.map((g) => {
                    const who = members.filter((m) => m.group_id === g.id)
                        .map((m) => peopleById.get(m.person_id)).filter(Boolean)
                        .sort((a, b) => a.name.localeCompare(b.name));
                    return (
                        <Card key={g.id} variant="flat" className="circle-group"
                            title={`${g.emoji ? `${g.emoji} ` : ''}${g.name}`}
                            actions={(
                                <>
                                    <Button size="sm" onClick={() => onShow(g.id)}>Open</Button>
                                    <ConfirmButton label={`Delete ${g.name}`} confirmLabel="Delete group?"
                                        onConfirm={() => deleteGroup(g.id)}>×</ConfirmButton>
                                </>
                            )}>
                            <p className="circle-group__count">{who.length} {who.length === 1 ? 'person' : 'people'}</p>
                            {who.length > 0 && (
                                <div className="circle-group__faces">
                                    {who.slice(0, 12).map((p) => <span key={p.id} title={p.name}><Avatar name={p.name} small /></span>)}
                                    {who.length > 12 && <span className="muted">+{who.length - 12}</span>}
                                </div>
                            )}
                            <textarea className="textarea circle-group__notes" rows={2} defaultValue={g.notes || ''}
                                placeholder="What this group is, inside jokes, the group chat name…"
                                aria-label={`Notes for ${g.name}`}
                                onBlur={(e) => {
                                    const v = e.target.value.trim() || null;
                                    if (v !== (g.notes || null)) updateGroup(g.id, { notes: v });
                                }} />
                        </Card>
                    );
                })}
            </div>
        </section>
    );
};

export default People;
