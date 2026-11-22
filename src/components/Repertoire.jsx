import React, { useMemo, useState } from 'react';
import {
    GiBallerinaShoes, GiMusicalNotes, GiPlayButton, GiPencil, GiQuillInk, GiTrashCan,
} from 'react-icons/gi';
import {
    Button, Card, Modal, Field, Tag, Stat, Tabs, TabPanel, ConfirmButton, EmptyState,
} from './ui';
import { useDanceSets } from '../hooks/useDanceSets';
import {
    parseChapters, matches, watchAt, fmtStamp, BLANK_SET, formFromSet,
} from '../utils/dances';
import { REPERTOIRE_SEED } from '../data/repertoireSeed';
import '../styles/Repertoire.css';

/**
 * The Repertoire — every dance she has choreographed, for sangeets, weddings
 * and the rest. Two ways in: by song ("have I done Gallan Goodiyan, and where
 * is that tutorial?") and by event (what each group danced).
 */

const VIEWS = [
    { id: 'songs', label: 'By song' },
    { id: 'sets', label: 'By event' },
];

const TONE = { easy: 'green', medium: 'gold', hard: 'red' };

const fmtDate = (d) => {
    if (!d) return null;
    const [y, m] = d.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const Level = ({ difficulty, mandatory }) => (
    <>
        {difficulty && <Tag tone={TONE[difficulty]}>{difficulty}</Tag>}
        {mandatory && <Tag>everyone</Tag>}
    </>
);

/** The three links a song can have inside one video. */
const Jumps = ({ clip, tutorial, slowed }) => (
    <span className="rep__jumps">
        {clip && <a href={clip} target="_blank" rel="noopener noreferrer"><GiPlayButton /> clip</a>}
        {tutorial && <a href={tutorial} target="_blank" rel="noopener noreferrer">tutorial</a>}
        {slowed && <a href={slowed} target="_blank" rel="noopener noreferrer">slowed</a>}
    </span>
);

const SetForm = ({ form, setForm }) => {
    const preview = useMemo(() => parseChapters(form.chapters), [form.chapters]);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    return (
        <div className="stack">
            <div className="field-row">
                <Field label="Event" value={form.event} onChange={set('event')} placeholder="Malvika + Nitin Wedding" />
                <Field label="Group" value={form.group_name} onChange={set('group_name')} placeholder="Friends, Bride's family…" />
            </div>
            <div className="field-row">
                <Field label="Date" type="date" value={form.performed_on} onChange={set('performed_on')} />
                <Field label="Tutorial video" value={form.video_url} onChange={set('video_url')} placeholder="https://www.youtube.com/watch?v=…" />
            </div>
            <Field
                as="textarea"
                rows={8}
                label="Chapters"
                hint="Paste the timestamps from the YouTube description. “Tutorial”, “Clip”/“Video” and “Slowed Down” at the end of a line, and (Easy)/(Medium) or (who dances it) in brackets, are read automatically."
                value={form.chapters}
                onChange={set('chapters')}
                placeholder={'00:02 - Shava Shava Video\n02:39 - Shava Shava Tutorial'}
            />
            {preview.length > 0 && (
                <ul className="rep__preview">
                    {preview.map((s) => (
                        <li key={s.title}>
                            <span>{s.title}</span>
                            {s.group && <span className="muted"> · {s.group}</span>}
                            <Level difficulty={s.difficulty} mandatory={s.mandatory} />
                            <span className="muted rep__stamps">
                                {[s.clip_at, s.tutorial_at, s.slowed_at]
                                    .filter((x) => x !== null).map(fmtStamp).join(' / ')}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <Field as="textarea" rows={2} label="Notes" value={form.notes} onChange={set('notes')} />
        </div>
    );
};

const Repertoire = () => {
    const { sets, songs, loading, error, addSet, addSets, updateSet, deleteSet } = useDanceSets();
    const [view, setView] = useState('songs');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null);   // null | 'new' | set id
    const [form, setForm] = useState(BLANK_SET);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const shownSongs = useMemo(
        () => songs.filter((s) => matches(query, s.title, ...s.uses.map((u) => u.event), ...s.uses.map((u) => u.group))),
        [songs, query]
    );
    const shownSets = useMemo(
        () => sets.filter((s) => matches(query, s.event, s.group_name, s.chapters)),
        [sets, query]
    );
    const events = useMemo(() => new Set(sets.map((s) => s.event)).size, [sets]);
    const favourite = songs[0];

    const open = (set) => {
        setForm(set ? formFromSet(set) : BLANK_SET);
        setEditing(set ? set.id : 'new');
        setSaveError(null);
    };
    const close = () => setEditing(null);

    const save = async () => {
        setSaving(true);
        setSaveError(null);
        try {
            if (editing === 'new') await addSet(form);
            else await updateSet(editing, form);
            close();
        } catch (e) {
            setSaveError(e.message || 'Could not save that');
        } finally {
            setSaving(false);
        }
    };

    const seed = async () => {
        setSaving(true);
        try { await addSets(REPERTOIRE_SEED); } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
    };

    if (loading) return <p className="muted">Gathering the repertoire…</p>;

    return (
        <div className="rep stack">
            <header className="row row--wrap rep__head">
                <h2 className="section-title"><GiBallerinaShoes /> The Repertoire</h2>
                <span className="spacer" />
                <Button variant="primary" onClick={() => open(null)}><GiQuillInk /> Add a dance</Button>
            </header>

            {(error || saveError) && <p className="rep__error">{error || saveError}</p>}

            {sets.length === 0 ? (
                <EmptyState
                    icon={<GiBallerinaShoes />}
                    message="No dances on the books yet."
                    hint="Bring in the seven tutorial videos already on YouTube (DK, Malvika + Nitin, Nishil + Swathi, NS), or add one by pasting its chapters."
                    actionLabel={saving ? 'Bringing them in…' : 'Bring in the seven'}
                    onAction={saving ? undefined : seed}
                />
            ) : (
                <>
                    <div className="stat-row">
                        <Stat value={sets.length} label="sets taught" />
                        <Stat value={events} label="events" />
                        <Stat value={songs.length} label="songs" />
                        {favourite && favourite.uses.length > 1 && (
                            <Stat value={favourite.title} label={`done ${favourite.uses.length} times`} />
                        )}
                    </div>

                    <div className="row row--wrap">
                        <Tabs tabs={VIEWS} active={view} onChange={setView} variant="segmented" label="Repertoire view" />
                        <span className="spacer" />
                        <input
                            className="input rep__search"
                            type="search"
                            aria-label="Search songs and events"
                            placeholder="Search a song, event or group"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    <TabPanel id="songs" active={view}>
                        {shownSongs.length === 0 ? (
                            <EmptyState inline message="Not in the repertoire yet." icon={<GiMusicalNotes />} />
                        ) : (
                            <ul className="rep__songs">
                                {shownSongs.map((s) => (
                                    <li key={s.key} className="rep__song">
                                        <div className="rep__song-head">
                                            <span className="rep__song-title">{s.title}</span>
                                            <Tag tone={s.uses.length > 1 ? 'gold' : 'default'}>
                                                {s.uses.length}×
                                            </Tag>
                                            <Level difficulty={s.difficulty} />
                                        </div>
                                        <ul className="rep__uses">
                                            {s.uses.map((u, i) => (
                                                <li key={`${u.set_id}-${i}`}>
                                                    <span>{u.event}{u.group ? ` · ${u.group}` : ''}</span>
                                                    {u.performed_on && <span className="muted"> · {fmtDate(u.performed_on)}</span>}
                                                    {u.as && <span className="muted rep__as"> in “{u.as}”</span>}
                                                    <Jumps clip={u.clip} tutorial={u.tutorial} slowed={u.slowed} />
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </TabPanel>

                    <TabPanel id="sets" active={view}>
                        {shownSets.length === 0 ? (
                            <EmptyState inline message="No event by that name." icon={<GiBallerinaShoes />} />
                        ) : (
                            <div className="rep__sets">
                                {shownSets.map((set) => {
                                    const list = parseChapters(set.chapters);
                                    return (
                                        <Card
                                            key={set.id}
                                            variant="flat"
                                            title={`${set.event}${set.group_name ? ` — ${set.group_name}` : ''}`}
                                            actions={(
                                                <>
                                                    <Button icon size="sm" variant="ghost" label="Edit" onClick={() => open(set)}><GiPencil /></Button>
                                                    <ConfirmButton size="sm" icon={<GiTrashCan />} onConfirm={() => deleteSet(set.id)} label="Remove this dance" confirmLabel="Strike it?" />
                                                </>
                                            )}
                                        >
                                            <p className="muted rep__meta">
                                                {fmtDate(set.performed_on) || 'Undated'}
                                                {set.video_url && (
                                                    <> · <a href={watchAt(set.video_url)} target="_blank" rel="noopener noreferrer">full video</a></>
                                                )}
                                            </p>
                                            <ol className="rep__setlist">
                                                {list.map((s) => (
                                                    <li key={s.title}>
                                                        <span>{s.title}</span>
                                                        {s.group && <span className="muted"> · {s.group}</span>}
                                                        <Level difficulty={s.difficulty} mandatory={s.mandatory} />
                                                        <Jumps
                                                            clip={s.clip_at !== null ? watchAt(set.video_url, s.clip_at) : null}
                                                            tutorial={s.tutorial_at !== null ? watchAt(set.video_url, s.tutorial_at) : null}
                                                            slowed={s.slowed_at !== null ? watchAt(set.video_url, s.slowed_at) : null}
                                                        />
                                                    </li>
                                                ))}
                                            </ol>
                                            {set.notes && <p className="rep__notes">{set.notes}</p>}
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </TabPanel>
                </>
            )}

            <Modal
                open={editing !== null}
                onClose={close}
                title={editing === 'new' ? 'Add a dance' : 'Edit this dance'}
                size="lg"
                footer={(
                    <>
                        <Button variant="ghost" onClick={close}>Cancel</Button>
                        <Button variant="primary" onClick={save} disabled={saving || !form.event.trim()}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </>
                )}
            >
                <SetForm form={form} setForm={setForm} />
                {saveError && <p className="rep__error">{saveError}</p>}
            </Modal>
        </div>
    );
};

export default Repertoire;
