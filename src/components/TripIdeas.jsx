import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { GiTrashCan, GiLightBulb, GiHouse, GiPathDistance, GiForkKnifeSpoon } from 'react-icons/gi';
import { Button, Card } from './ui';
import MentionInput from './MentionInput';
import { formatMoney } from '../utils/tripCosts';
import { mapFor, pageFor } from '../utils/mapsLink';
import PlaceField from './PlaceField';
import { tripRect } from '../utils/tripBounds';
import { ideasAsText, countable } from '../utils/ideasText';

/**
 * Somewhere to put an idea before it has a date.
 *
 * Three columns, because "what shall we do", "where shall we eat" and "where
 * shall we stay" are three different piles and always have been. Eating used
 * to go in with doing, where a restaurant someone mentioned sat between a
 * houseboat and a shopping trip and could not be found again when the question
 * was the one it was written down to answer. One line of typing gets an idea in;
 * everything else — a link, a rough cost, a neighbourhood — is optional and
 * hidden until asked for, because a form with six boxes is a form you do not
 * fill in when you are half-reading a message from a friend.
 *
 * The part that earns the feature is promotion. An idea can be put on a day,
 * where it becomes a real plan, or booked, where it becomes a stay with dates.
 * Without that this is a notes app that happens to live next to a trip.
 */

const IdeaRow = ({ idea, currency, near, onUpdate, onDelete, onAdopt, onPromote, canPromote }) => {
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
                    /* The map, so the stop it becomes can be found; the
                       address, so the drive time to the next one can be
                       worked out at all. */
                    url: mapFor(idea) || idea.url, area: idea.area,
                    place_id: idea.place_id || null,
                }));
            }}
        >
            <div className="idea__head">
                <MentionInput
                    className="idea__title"
                    value={idea.title}
                    aria-label="Idea"
                    near={near}
                    onChange={(title) => onUpdate(idea.id, { title })}
                    onPick={(place, title) => onUpdate(idea.id, {
                        title,
                        /* The place id, not the map url: `url` is the page she
                           saved, and a place picked here used to overwrite
                           it. The full address rather than the neighbourhood,
                           because that is what a day item needs to work out a
                           drive time from. */
                        place_id: place.place_id || idea.place_id || null,
                        area: place.address || idea.area,
                    })}
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
                {/* Two different links wanted the one `url` column: the map,
                    and whatever page she actually saved. The map is worked
                    out from the place id when it is drawn, so saving a menu
                    no longer overwrites the map — and vice versa. */}
                {mapFor(idea) && (
                    <a href={mapFor(idea)} target="_blank" rel="noopener noreferrer">map</a>
                )}
                {pageFor(idea) && (
                    <a href={pageFor(idea)} target="_blank" rel="noopener noreferrer">link</a>
                )}
                {idea.promoted_at && (
                    <em className="idea__done">
                        on the plan · {format(parseISO(idea.promoted_at.slice(0, 10)), 'd MMM')}
                    </em>
                )}
                {/* An idea with no trip is one she dictated before there was
                    a trip to put it on, so it shows on every board. Saying so
                    is the difference between "I planned this for Goa" and
                    "this has been sitting in the pile since March" — and the
                    label is the button that ends it, because the moment she
                    notices it belongs here is the moment to say so. */}
                {idea.trip_id == null && (
                    <button
                        type="button"
                        className="idea__loose"
                        title={`Keep ${idea.title} on this trip`}
                        onClick={() => onAdopt(idea.id)}
                    >
                        someday · keep here
                    </button>
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
                    </div>

                    {/* Naming it with an @ was the only way an idea ever got
                        a real place, and only at the moment of typing. This
                        is the other way in — and it matters more here than
                        anywhere, because dragging an idea onto a day carries
                        its address across, and an address is what the drive
                        times are worked out from. */}
                    <PlaceField
                        className="idea__place"
                        location={idea.area}
                        link={mapFor(idea)}
                        label={idea.title || 'this idea'}
                        onPick={(patch) => onUpdate(idea.id, {
                            area: patch.location,
                            place_id: patch.place_id,
                        })}
                        onClear={idea.area
                            ? () => onUpdate(idea.id, { area: null, place_id: null })
                            : undefined}
                    />
                </div>
            )}

            {/* Only offered once there is somewhere to promote it *to*. */}
            {canPromote && !idea.promoted_at && (
                <div className="idea__promote">{onPromote(idea)}</div>
            )}
        </li>
    );
};

const PROMPT = {
    do: 'Something to do…',
    eat: 'Somewhere to eat…',
    stay: 'Somewhere to stay…',
};

const LABEL = {
    do: 'A thing to do',
    eat: 'A place to eat',
    stay: 'A place to stay',
};

const Column = ({ title, icon, kind, ideas, currency, near, hooks, placeholder, onAdopt, onPromote, canPromote }) => {
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
                        near={near}
                        onUpdate={hooks.updateIdea}
                        onDelete={hooks.deleteIdea}
                        onAdopt={onAdopt}
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
                <MentionInput
                    value={draft}
                    placeholder={PROMPT[kind]}
                    aria-label={LABEL[kind]}
                    near={near}
                    onChange={setDraft}
                    onPick={(place, text) => {
                        hooks.addIdea({
                            kind,
                            title: text.trim() || place.name,
                            /* The id, so the map can be worked out and `url`
                               stays free for a page she saves. The full
                               address, not just the neighbourhood, because a
                               drive time cannot be worked out from "Rutherford". */
                            place_id: place.place_id || null,
                            area: place.address || null,
                        });
                        setDraft('');
                    }}
                />
            </form>
        </div>
    );
};

const TripIdeas = ({ trip, days = [], legs = [], hooks, onAddToDay, onBook }) => {
    const currency = trip?.currency || 'USD';
    /* Where a place mentioned here could be. An idea has no date, so it
       belongs to the whole trip rather than to one city of it — a box around
       every leg, which contains all of them and invents no middle the trip
       never visits. */
    const near = tripRect(legs) || (trip?.destination ? { city: trip.destination } : null);
    /* Which day each idea is being put on, by idea. One shared value meant
       choosing a day for one idea chose it for all of them. */
    const [target, setTarget] = useState({});
    const [copied, setCopied] = useState(false);
    /* The text itself, shown only when the clipboard would not take it. */
    const [spilled, setSpilled] = useState(null);

    const all = [...(hooks.toDo || []), ...(hooks.toEat || []), ...(hooks.toStay || [])];
    const sendable = countable(all);

    const copyOut = async () => {
        const text = ideasAsText(all, { tripName: trip?.destination, currency });
        if (!text) return;

        /* Three ways this fails and all of them are silent: no clipboard on an
           insecure origin, a permission refused, and — the one that caught me —
           a writeText that never settles because the page is not focused. So
           it is raced against a clock, and nothing claims success until one of
           the two routes has actually reported it. */
        const wrote = await Promise.race([
            navigator.clipboard?.writeText(text).then(() => true, () => false)
                ?? Promise.resolve(false),
            new Promise((yes) => { setTimeout(() => yes(false), 1200); }),
        ]);

        let ok = wrote;
        if (!ok) {
            // The oldest trick, which works in places the new API does not.
            const box = document.createElement('textarea');
            box.value = text;
            box.setAttribute('readonly', '');
            box.style.position = 'fixed';
            box.style.opacity = '0';
            document.body.appendChild(box);
            box.select();
            try { ok = document.execCommand('copy'); } catch { ok = false; } finally { box.remove(); }
        }

        if (ok) {
            setSpilled(null);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            return;
        }

        /* Neither route worked. A button that says "Copied" when nothing was
           copied is worse than one that admits it, so the text comes out onto
           the page where she can select it herself. */
        setSpilled(text);
    };

    if (!trip) return null;

    const dated = days.filter((d) => d.date);

    /* "This one is for this trip." A dictated idea has no trip and shows on
       every board; saying it belongs here takes it off the others. It is not
       promotion — nothing has a date yet — it is only narrowing where it
       shows, which is why it is a label and not a button in the promote row. */
    const adopt = (id) => hooks.updateIdea(id, { trip_id: trip.id });

    const promoteToDay = (idea, kind = 'todo') => (
        <>
            <select
                value={target[idea.id] || ''}
                aria-label="Which day"
                onChange={(e) => setTarget((prev) => ({ ...prev, [idea.id]: e.target.value }))}
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
                disabled={!target[idea.id]}
                onClick={async () => {
                    const day = dated.find((d) => String(d.id) === String(target[idea.id]));
                    if (!day) return;
                    await onAddToDay?.(day.id, {
                        title: idea.title,
                        kind,
                        cost: idea.cost ?? null,
                        // The place it was found at goes across too: the whole
                        // point of "@masque" was not typing it twice — and the
                        // stop cannot have a drive time without an address.
                        link: mapFor(idea) || idea.url || null,
                        location: idea.area || null,
                        place_id: idea.place_id || null,
                    });
                    await hooks.markPromoted(idea.id);
                    setTarget((prev) => ({ ...prev, [idea.id]: '' }));
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

                {/* The board is for planning; this is for asking. "Here are
                    the six places, which do you fancy" is a message, and the
                    only way to send it was to retype it or screenshot it —
                    a screenshot being the version nobody can tap a link in. */}
                <Button
                    size="sm"
                    variant="ghost"
                    className="ideas__copy"
                    disabled={!sendable}
                    onClick={copyOut}
                    title={sendable
                        ? 'Copy every idea as plain text, with a link on each one that has one'
                        : 'Nothing to send yet'}
                >
                    {copied ? '✓ Copied' : `Copy ${sendable || ''} to send`.trim()}
                </Button>
            </header>

            {spilled && (
                <div className="ideas__spill">
                    <p>Your browser would not hand over the clipboard. Here it is — select it and copy.</p>
                    <textarea
                        readOnly
                        className="textarea ideas__spill-text"
                        aria-label="The ideas as text"
                        value={spilled}
                        rows={Math.min(16, spilled.split('\n').length + 1)}
                        ref={(el) => { if (el) { el.focus(); el.select(); } }}
                    />
                    <Button size="sm" variant="ghost" onClick={() => setSpilled(null)}>Close</Button>
                </div>
            )}

            <div className="ideas__columns">
                <Column
                    title="Things to do"
                    icon={<GiPathDistance />}
                    kind="do"
                    ideas={hooks.toDo}
                    currency={currency}
                    near={near}
                    hooks={hooks}
                    placeholder="Nothing yet. Type anything you might want to do."
                    onAdopt={adopt}
                    onPromote={promoteToDay}
                    canPromote={dated.length > 0 && Boolean(onAddToDay)}
                />
                <Column
                    title="Places to eat"
                    icon={<GiForkKnifeSpoon />}
                    kind="eat"
                    ideas={hooks.toEat}
                    currency={currency}
                    near={near}
                    hooks={hooks}
                    placeholder="Nowhere yet. Restaurants, a bakery, the place with the good coffee."
                    /* Put on a day it becomes a meal, not a to-do: it lands in
                       the food bucket, where the trip's food budget adds up. */
                    onAdopt={adopt}
                    onPromote={(idea) => promoteToDay(idea, 'food')}
                    canPromote={dated.length > 0 && Boolean(onAddToDay)}
                />
                <Column
                    title="Places to stay"
                    icon={<GiHouse />}
                    kind="stay"
                    ideas={hooks.toStay}
                    currency={currency}
                    near={near}
                    hooks={hooks}
                    placeholder="Nowhere yet. Hotels, rentals, a friend's spare room."
                    onAdopt={adopt}
                    onPromote={promoteToStay}
                    canPromote={Boolean(onBook)}
                />
            </div>
        </Card>
    );
};

export default TripIdeas;
