import React, { useState, useMemo } from 'react';
import {
    GiOpenBook, GiCheckMark, GiTrashCan, GiPositionMarker, GiCookingPot,
    GiBookmarklet, GiFilmSpool, GiMusicalNotes, GiShoppingBag, GiHammerNails,
    GiSparkles, GiScrollUnfurled,
} from 'react-icons/gi';
import { PageHeader, Card, Button, Tabs, Tag, EmptyState, ConfirmButton, Field } from '../components/ui';
import { useCapture } from '../contexts/CaptureContext';
import { usePlans } from '../hooks/usePlans';
import '../styles/Commonplace.css';

/**
 * The Commonplace — a commonplace book is where you paste what you found and
 * what you meant to do with it, which is exactly this.
 *
 * The rooms hold the structured half of a save (a recipe's ingredients, a
 * spot's address). This page holds the other half: the steps, whether she
 * worked through them, and what she thought afterwards.
 */

const CATEGORY_ICON = {
    recipe: <GiCookingPot />,
    place: <GiPositionMarker />,
    read: <GiBookmarklet />,
    watch: <GiFilmSpool />,
    listen: <GiMusicalNotes />,
    buy: <GiShoppingBag />,
    make: <GiHammerNails />,
    try: <GiSparkles />,
};

const VIEWS = [
    { id: 'open', label: 'To do' },
    { id: 'doing', label: 'Underway' },
    { id: 'done', label: 'Done' },
    { id: 'all', label: 'Everything' },
];

const sourceLabel = (plan) => {
    if (plan.platform && plan.platform !== 'web' && plan.platform !== 'capture') return plan.platform;
    if (!plan.source_url) return null;
    try {
        return new URL(plan.source_url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
};

const Stars = ({ value, onRate }) => (
    <span className="plan__stars" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
            <button
                key={n}
                type="button"
                className={`plan__star${value >= n ? ' plan__star--on' : ''}`}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                aria-pressed={value === n}
                onClick={() => onRate(n)}
            >
                ★
            </button>
        ))}
    </span>
);

const Plan = ({ plan, toggleStep, setStatus, rate, setNotes, remove }) => {
    const [noteDraft, setNoteDraft] = useState(plan.notes || '');
    const [editingNote, setEditingNote] = useState(false);

    const steps = plan.steps || [];
    const doneCount = steps.filter((s) => s.done).length;
    const source = sourceLabel(plan);

    return (
        <Card variant="flat" className={`plan${plan.status === 'done' ? ' plan--done' : ''}`}>
            {plan.thumbnail_url && (
                <div className="plan__thumb">
                    <img src={plan.thumbnail_url} alt="" loading="lazy" />
                </div>
            )}

            <div className="plan__head">
                <h2 className="plan__title">
                    {plan.source_url ? (
                        <a href={plan.source_url} target="_blank" rel="noopener noreferrer">{plan.title}</a>
                    ) : plan.title}
                </h2>

                <div className="plan__meta">
                    {plan.intent && (
                        <Tag tone="gold">
                            {CATEGORY_ICON[plan.category] || <GiScrollUnfurled />} {plan.intent}
                        </Tag>
                    )}
                    {source && <span className="plan__source">{source}</span>}
                    {plan.author && <span className="plan__source">{plan.author}</span>}
                </div>
            </div>

            {plan.excerpt && !steps.length && (
                <p className="plan__excerpt">{plan.excerpt}</p>
            )}

            {steps.length > 0 && (
                <>
                    <p className="plan__progress">
                        {doneCount} of {steps.length} done
                    </p>
                    <ol className="plan__steps">
                        {steps.map((step, i) => (
                            <li key={`${plan.id}-${i}`} className={step.done ? 'plan__step plan__step--done' : 'plan__step'}>
                                <button
                                    type="button"
                                    className="plan__step-btn"
                                    role="checkbox"
                                    aria-checked={!!step.done}
                                    onClick={() => toggleStep(plan, i)}
                                >
                                    <span className="plan__box" aria-hidden="true">{step.done && <GiCheckMark />}</span>
                                    <span>{step.text}</span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </>
            )}

            <div className="plan__foot">
                {plan.status === 'done' ? (
                    <>
                        <Stars value={plan.rating || 0} onRate={(n) => rate(plan, n)} />
                        <Button size="sm" onClick={() => setStatus(plan, 'saved')}>Reopen</Button>
                    </>
                ) : (
                    <Button size="sm" variant="primary" onClick={() => setStatus(plan, 'done')}>
                        <GiCheckMark /> Mark done
                    </Button>
                )}

                <ConfirmButton icon size="sm" label={`Delete ${plan.title}`} onConfirm={() => remove(plan.id)}>
                    <GiTrashCan />
                </ConfirmButton>
            </div>

            {/* The note is the point of the whole record: what it was actually
                like, written while she still remembers. */}
            {(plan.status === 'done' || plan.notes || editingNote) && (
                editingNote ? (
                    <div className="plan__note-edit">
                        <Field label="How was it?">
                            <textarea
                                className="input"
                                rows={2}
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                            />
                        </Field>
                        <Button size="sm" onClick={() => { setNotes(plan, noteDraft); setEditingNote(false); }}>
                            Save note
                        </Button>
                    </div>
                ) : (
                    <button type="button" className="plan__note" onClick={() => setEditingNote(true)}>
                        {plan.notes || 'Add a note…'}
                    </button>
                )
            )}
        </Card>
    );
};

const Commonplace = () => {
    const { plans, loading, error, toggleStep, setStatus, rate, setNotes, remove } = usePlans();
    const { submit, pending } = useCapture();
    const [link, setLink] = useState('');
    const [view, setView] = useState('open');

    const counts = useMemo(() => ({
        open: plans.filter((p) => p.status === 'saved').length,
        doing: plans.filter((p) => p.status === 'doing').length,
        done: plans.filter((p) => p.status === 'done').length,
        all: plans.length,
    }), [plans]);

    const visible = useMemo(() => {
        if (view === 'all') return plans;
        if (view === 'open') return plans.filter((p) => p.status === 'saved');
        return plans.filter((p) => p.status === view);
    }, [plans, view]);

    const save = async (e) => {
        e.preventDefault();
        if (!link.trim() || pending) return;
        const outcome = await submit(link.trim());
        if (outcome) setLink('');
    };

    return (
        <div className="commonplace">
            <PageHeader
                title="The Commonplace"
                subtitle="Things worth keeping, and whether you ever got round to them."
                icon={<GiOpenBook />}
            />

            <form className="commonplace__add" onSubmit={save}>
                <Field
                    label="Paste a link"
                    type="url"
                    placeholder="A TikTok, a video, a recipe, an article…"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                />
                <Button type="submit" variant="primary" disabled={!link.trim() || pending}>
                    {pending ? 'Reading…' : 'Save it'}
                </Button>
            </form>

            <Tabs
                label="Commonplace views"
                active={view}
                onChange={setView}
                tabs={VIEWS.map((v) => ({ ...v, count: counts[v.id] }))}
            />

            {error && <p className="commonplace__error">{error}</p>}

            {loading ? (
                <p className="muted">Opening the Commonplace…</p>
            ) : visible.length === 0 ? (
                <EmptyState
                    icon={<GiOpenBook />}
                    message={plans.length ? 'Nothing here.' : 'The Commonplace is empty.'}
                    hint={plans.length
                        ? 'Try another view.'
                        : 'Paste a link above, share one from your phone, or just say what you want to try.'}
                />
            ) : (
                <div className="commonplace__grid">
                    {visible.map((plan) => (
                        <Plan
                            key={plan.id}
                            plan={plan}
                            toggleStep={toggleStep}
                            setStatus={setStatus}
                            rate={rate}
                            setNotes={setNotes}
                            remove={remove}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Commonplace;
