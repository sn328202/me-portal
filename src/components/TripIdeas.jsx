import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { GiTrashCan, GiLightBulb, GiHouse, GiPathDistance } from 'react-icons/gi';
import { Button, Card } from './ui';
import { formatMoney } from '../utils/tripCosts';

/**
 * Somewhere to put an idea before it has a date.
 *
 * Two columns, because "what shall we do" and "where shall we stay" are two
 * different piles and always have been. One line of typing gets an idea in;
 * everything else — a link, a rough cost, a neighbourhood — is optional and
 * hidden until asked for, because a form with six boxes is a form you do not
 * fill in when you are half-reading a message from a friend.
 *
 * The part that earns the feature is promotion. An idea can be put on a day,
 * where it becomes a real plan, or booked, where it becomes a stay with dates.
 * Without that this is a notes app that happens to live next to a trip.
 */

const IdeaRow = ({ idea, currency, onUpdate, onDelete, onPromote, canPromote }) => {
    const [open, setOpen] = useState(false);

    return (
        <li
            className={`idea${idea.promoted_at ? ' is-promoted' : ''}`}
            /* Dragged onto an hour on the timeline, an idea becomes a plan at
               that date and time — which is the shortest path there is from
               "someone mentioned this" to a thing on a Tuesday. */
            draggable={!idea.promoted_at}
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/x-idea', JSON.stringify({
                    id: idea.id, title: idea.title, cost: idea.cost, kind: idea.kind,
                }));
            }}
        >
            <div className="idea__head">
                <input
                    type="text"
                    className="idea__title"
                    value={idea.title}
                    aria-label="Idea"
                    onChange={(e) => onUpdate(idea.id, { title: e.target.value })}
                />
                <button
                    type="button"
                    className="idea__more"
                    aria-expanded={open}
                    aria-label={open ? 'Fewer details' : 'More details'}
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? '−' : '+'}
                </button>
                <button
                    type="button"
                    className="idea__drop"
                    aria-label={`Remove ${idea.title}`}
                    onClick={() => onDelete(idea.id)}
                >
                    <GiTrashCan />
                </button>
            </div>

            <div className="idea__facts">
                {idea.cost != null && <span>{formatMoney(idea.cost, currency)}</span>}
                {idea.area && <span>{idea.area}</span>}
                {idea.url && (
                    <a href={idea.url} target="_blank" rel="noopener noreferrer">link</a>
                )}
                {idea.promoted_at && (
                    <em className="idea__done">
                        on the plan · {format(parseISO(idea.promoted_at.slice(0, 10)), 'd MMM')}
                    </em>
                )}
            </div>

            {open && (
                <div className="idea__detail">
                    <textarea
                        rows={2}
                        placeholder="Why it's a good idea…"
                        value={idea.notes || ''}
                        aria-label="Notes"
                        onChange={(e) => onUpdate(idea.id, { notes: e.target.value })}
                    />
                    <div className="idea__fields">
                        <input
                            type="url"
                            placeholder="Link"
                            value={idea.url || ''}
                            aria-label="Link"
                            onChange={(e) => onUpdate(idea.id, { url: e.target.value })}
                        />
                        <input
                            type="number"
                            inputMode="decimal"
                            placeholder="Cost"
                            value={idea.cost ?? ''}
                            aria-label="Rough cost"
                            onChange={(e) => onUpdate(idea.id, {
                                cost: e.target.value === '' ? null : Number(e.target.value),
                            })}
                        />
                        <input
                            type="text"
                            placeholder={idea.kind === 'stay' ? 'Where' : 'Neighbourhood'}
                            value={idea.area || ''}
                            aria-label="Area"
                            onChange={(e) => onUpdate(idea.id, { area: e.target.value })}
                        />
                    </div>
                </div>
            )}

            {/* Only offered once there is somewhere to promote it *to*. */}
            {canPromote && !idea.promoted_at && (
                <div className="idea__promote">{onPromote(idea)}</div>
            )}
        </li>
    );
};

const Column = ({ title, icon, kind, ideas, currency, hooks, placeholder, onPromote, canPromote }) => {
    const [draft, setDraft] = useState('');

    const submit = (e) => {
        e.preventDefault();
        const title = draft.trim();
        if (!title) return;
        hooks.addIdea({ kind, title });
        setDraft('');
    };

    const live = ideas.filter((i) => !i.promoted_at);
    const gone = ideas.filter((i) => i.promoted_at);

    return (
        <div className="ideas__column">
            <h4>{icon} {title} <span className="ideas__count">{live.length}</span></h4>

            <ul className="ideas__list">
                {ideas.map((idea) => (
                    <IdeaRow
                        key={idea.id}
                        idea={idea}
                        currency={currency}
                        onUpdate={hooks.updateIdea}
                        onDelete={hooks.deleteIdea}
                        onPromote={onPromote}
                        canPromote={canPromote}
                    />
                ))}
            </ul>

            {!ideas.length && <p className="ideas__empty">{placeholder}</p>}
            {gone.length > 0 && (
                <p className="ideas__moved">{gone.length} already on the plan.</p>
            )}

            <form className="ideas__add" onSubmit={submit}>
                <input
                    type="text"
                    value={draft}
                    placeholder={kind === 'stay' ? 'Somewhere to stay…' : 'Something to do…'}
                    aria-label={kind === 'stay' ? 'A place to stay' : 'A thing to do'}
                    onChange={(e) => setDraft(e.target.value)}
                />
            </form>
        </div>
    );
};

const TripIdeas = ({ trip, days = [], hooks, onAddToDay, onBook }) => {
    const currency = trip?.currency || 'USD';
    const [target, setTarget] = useState('');

    if (!trip) return null;

    const dated = days.filter((d) => d.date);

    const promoteToDay = (idea) => (
        <>
            <select
                value={target}
                aria-label="Which day"
                onChange={(e) => setTarget(e.target.value)}
            >
                <option value="">Put it on…</option>
                {dated.map((d) => (
                    <option key={d.id} value={d.id}>
                        {format(parseISO(String(d.date).slice(0, 10)), 'EEE d MMM')}
                    </option>
                ))}
            </select>
            <Button
                size="sm"
                variant="ghost"
                disabled={!target}
                onClick={async () => {
                    const day = dated.find((d) => String(d.id) === String(target));
                    if (!day) return;
                    await onAddToDay?.(day.id, {
                        title: idea.title,
                        kind: 'todo',
                        cost: idea.cost ?? null,
                    });
                    await hooks.markPromoted(idea.id);
                    setTarget('');
                }}
            >
                Add
            </Button>
        </>
    );

    const promoteToStay = (idea) => (
        <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
                await onBook?.({
                    name: idea.title,
                    // Dates are the one thing an idea does not have, so the
                    // stay arrives needing them — which is honest, and puts the
                    // question where the calendar is.
                    check_in: trip.start_date || '',
                    check_out: trip.start_date || '',
                    cost: idea.cost ?? 0,
                    cost_shared: true,
                });
                await hooks.markPromoted(idea.id);
            }}
        >
            Book it
        </Button>
    );

    return (
        <Card className="ideas">
            <header className="ideas__head">
                <h3><GiLightBulb /> Ideas</h3>
                <span className="ideas__hint">Anything you might do. Dates optional.</span>
            </header>

            <div className="ideas__columns">
                <Column
                    title="Things to do"
                    icon={<GiPathDistance />}
                    kind="do"
                    ideas={hooks.toDo}
                    currency={currency}
                    hooks={hooks}
                    placeholder="Nothing yet. Type anything you might want to do."
                    onPromote={promoteToDay}
                    canPromote={dated.length > 0 && Boolean(onAddToDay)}
                />
                <Column
                    title="Places to stay"
                    icon={<GiHouse />}
                    kind="stay"
                    ideas={hooks.toStay}
                    currency={currency}
                    hooks={hooks}
                    placeholder="Nowhere yet. Hotels, rentals, a friend's spare room."
                    onPromote={promoteToStay}
                    canPromote={Boolean(onBook)}
                />
            </div>
        </Card>
    );
};

export default TripIdeas;
