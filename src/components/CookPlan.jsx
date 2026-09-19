import React, { useState } from 'react';
import {
    GiCancel, GiCheckMark, GiCookingPot, GiPencil, GiTrashCan,
    GiHourglass, GiSandsOfTime, GiAlarmClock,
} from 'react-icons/gi';
import { supabase } from '../lib/supabase';
import { Button, Field, Modal, EmptyState, Stat } from './ui';
import DateField from './DateField';
import {
    groupByDay, planLoad, clockLabel, lengthLabel, offsetFrom, minutesBefore,
    readDate, readClock,
} from '../../api/_cookPlan.js';
import '../styles/CookPlan.css';

/**
 * How to cook a menu so that all of it is ready at once.
 *
 * A menu is a list of dishes, and the thing it cannot tell her by looking at
 * it is what has to happen yesterday. Prep and cook times add up to an
 * afternoon; the overnight soak and the dough that has to rest are sentences
 * in the middle of a method, and they are the only steps that cannot be
 * rescued by starting early on the day.
 *
 * So: she says when she is serving, the endpoint reads every method looking
 * for exactly those, and the plan comes back as times on a clock — counted
 * backwards from dinner, over as many days as it takes.
 *
 * It is hers once it is built. Steps tick off while she cooks, and any of
 * them can be reworded, moved or thrown away: a plan she cannot correct is
 * one she stops trusting the first time it is wrong about her kitchen.
 */

const BLANK = { what: '', dish: '', date: '', time: '', minutes: 0, waiting: false };

const CookPlan = ({ menu, onClose, onSetServeTime, onSavePlan }) => {
    const [serveDate, setServeDate] = useState(menu.serve_date || '');
    const [serveTime, setServeTime] = useState(menu.serve_time || '');
    const [building, setBuilding] = useState(false);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(null);   // a step id, or 'new'
    const [draft, setDraft] = useState(BLANK);

    const plan = menu.plan || null;
    const steps = plan?.steps || [];
    const ready = !!readDate(serveDate) && readClock(serveTime) !== null;
    const days = groupByDay(steps, plan?.serve_date || serveDate);
    const load = planLoad(steps);

    const dishes = (menu.user_larder_menu_recipes || []).filter((mr) => mr.recipe_id).length;

    /* The serve time is saved the moment it is a time, so a plan built after
       it always counts back from the right dinner — and a plan built before it
       moves with it rather than going stale. */
    const commitServe = async (nextDate, nextTime) => {
        setServeDate(nextDate);
        setServeTime(nextTime);
        if (!readDate(nextDate) || readClock(nextTime) === null) return;
        try {
            await onSetServeTime(menu.id, { serve_date: nextDate, serve_time: nextTime });
        } catch (err) {
            console.error(err);
            setError("Couldn't save that. Check your connection and try again.");
        }
    };

    const build = async () => {
        if (!ready || building) return;
        setBuilding(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/cook-plan', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    Authorization: `Bearer ${session?.access_token || ''}`,
                },
                body: JSON.stringify({ menu_id: menu.id, serve_date: serveDate, serve_time: serveTime }),
            });
            const json = await res.json();
            if (!json.ok) { setError(json.error || "Couldn't build the schedule. Try again."); return; }
            await onSavePlan(menu.id, json.plan);
        } catch (err) {
            console.error(err);
            setError("Couldn't build the schedule. Check your connection and try again.");
        } finally {
            setBuilding(false);
        }
    };

    const writeSteps = async (next) => {
        try {
            await onSavePlan(menu.id, { ...plan, steps: next });
        } catch (err) {
            console.error(err);
            setError("Couldn't save that. Check your connection and try again.");
        }
    };

    const toggle = (step) => writeSteps(steps.map((s) => (
        s.id === step.id ? { ...s, done: !s.done } : s
    )));

    const startEdit = (step) => {
        setEditing(step.id);
        setDraft({
            what: step.what,
            dish: step.dish || '',
            date: step.at_date,
            time: step.at_time,
            minutes: step.minutes || 0,
            waiting: !!step.waiting,
        });
    };

    const startNew = () => {
        setEditing('new');
        // A new step defaults to an hour before dinner, which is where most of
        // the ones she thinks of afterwards belong.
        const at = minutesBefore(plan.serve_date, plan.serve_time, 60);
        setDraft({ ...BLANK, date: at?.date || plan.serve_date, time: at?.time || plan.serve_time });
    };

    const saveEdit = () => {
        const what = draft.what.trim();
        if (!what) return;
        const serve = { serve_date: plan.serve_date, serve_time: plan.serve_time };
        const ahead = offsetFrom(serve, { date: draft.date, time: draft.time });
        if (ahead === null) { setError("That time is after you're serving — pick an earlier one."); return; }

        const edited = {
            what,
            dish: draft.dish.trim(),
            minutes: Math.max(Number(draft.minutes) || 0, 0),
            waiting: !!draft.waiting,
            starts_before_serve: ahead,
            at_date: draft.date,
            at_time: draft.time,
        };

        const next = editing === 'new'
            ? [...steps, { id: `n${Date.now()}`, recipe_id: null, done: false, ...edited }]
            : steps.map((s) => (s.id === editing ? { ...s, ...edited } : s));

        setEditing(null);
        setError(null);
        writeSteps(next);
    };

    const removeStep = (id) => writeSteps(steps.filter((s) => s.id !== id));

    const editor = (
        <div className="cookplan__editor">
            <Field
                label="What to do"
                type="text"
                value={draft.what}
                placeholder="Soak the chana in plenty of cold water"
                onChange={(e) => setDraft({ ...draft, what: e.target.value })}
                autoFocus
            />
            <div className="cookplan__editor-row">
                <Field label="For which dish">
                    <input
                        className="input"
                        type="text"
                        value={draft.dish}
                        placeholder="Everything"
                        onChange={(e) => setDraft({ ...draft, dish: e.target.value })}
                    />
                </Field>
                <Field label="Day">
                    <DateField
                        className="input"
                        value={draft.date}
                        onCommit={(v) => setDraft({ ...draft, date: v })}
                    />
                </Field>
                <Field
                    label="At"
                    type="time"
                    value={draft.time}
                    onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                />
                <Field
                    label="Takes"
                    hint="minutes"
                    type="number"
                    min="0"
                    value={draft.minutes}
                    onChange={(e) => setDraft({ ...draft, minutes: e.target.value })}
                />
            </div>
            <label className="cookplan__waiting-toggle">
                <input
                    type="checkbox"
                    checked={draft.waiting}
                    onChange={(e) => setDraft({ ...draft, waiting: e.target.checked })}
                />
                This one waits by itself — soaking, rising, chilling
            </label>
            <div className="cookplan__editor-actions">
                <Button size="sm" onClick={() => { setEditing(null); setError(null); }}>Cancel</Button>
                <Button size="sm" variant="solid" onClick={saveEdit} disabled={!draft.what.trim()}>
                    Save step
                </Button>
            </div>
        </div>
    );

    return (
        <Modal open onClose={onClose} size="full" labelledBy="cookplan-title">
            <div className="cookplan">
                <div className="cookplan__head">
                    <div>
                        <h2 id="cookplan-title" className="cookplan__title">
                            <GiCookingPot /> {menu.title}
                        </h2>
                        <p className="cookplan__sub">
                            {dishes} {dishes === 1 ? 'dish to cook' : 'dishes to cook'}
                            {menu.occasion ? ` · ${menu.occasion}` : ''}
                        </p>
                    </div>
                    <Button variant="ghost" onClick={onClose}>
                        <GiCancel /> Close
                    </Button>
                </div>

                <div className="cookplan__when">
                    <Field label="Serving on">
                        <DateField
                            className="input"
                            value={serveDate}
                            onCommit={(v) => commitServe(v, serveTime)}
                        />
                    </Field>
                    <Field
                        className="cookplan__when-time"
                        label="At"
                        type="time"
                        value={serveTime}
                        onChange={(e) => commitServe(serveDate, e.target.value)}
                    />
                    <Button
                        variant="solid"
                        onClick={build}
                        disabled={!ready || building || !dishes}
                    >
                        {building ? 'Working it out…' : plan ? 'Build it again' : 'Build the schedule'}
                    </Button>
                </div>

                {!ready && (
                    <p className="cookplan__hint">
                        Say when you are serving it and it can count backwards from there.
                    </p>
                )}
                {!dishes && (
                    <p className="cookplan__hint">
                        There is nothing to cook on this menu yet — add a recipe and it can plan around it.
                    </p>
                )}
                {error && <p className="cookplan__error" role="alert">{error}</p>}
                {building && (
                    <p className="cookplan__hint">
                        Reading every method for the things that have to happen in advance.
                    </p>
                )}

                {!plan && !building && (
                    <EmptyState
                        icon={<GiSandsOfTime />}
                        message="No schedule yet."
                        hint="It will read the recipes and work backwards from your serve time — including the soaking, marinating and resting that has to start the day before."
                    />
                )}

                {plan && (
                    <>
                        {plan.note && <p className="cookplan__note">{plan.note}</p>}

                        <div className="stat-row">
                            <Stat
                                icon={<GiAlarmClock />}
                                value={load.starts ? clockLabel(load.starts.time) : '—'}
                                label={load.starts
                                    ? (load.starts.date === plan.serve_date ? 'Start on the day' : 'Start the day before')
                                    : 'Nothing to start'}
                            />
                            <Stat icon={<GiHourglass />} value={lengthLabel(load.handsOn) || '0 min'} label="Hands on" />
                            <Stat icon={<GiCheckMark />} value={`${load.done}/${load.steps}`} label="Done" />
                        </div>

                        <div className="cookplan__days">
                            {days.map((day) => (
                                <section key={day.date} className="cookplan__day">
                                    <h3 className="cookplan__day-title">
                                        <span>{day.label}</span>
                                        <span className="cookplan__day-date">{day.date}</span>
                                    </h3>
                                    <ul className="cookplan__steps">
                                        {day.steps.map((step) => (
                                            <li
                                                key={step.id}
                                                className={`cookplan__step${step.done ? ' cookplan__step--done' : ''}`}
                                            >
                                                {editing === step.id ? editor : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="cookplan__tick"
                                                            role="checkbox"
                                                            aria-checked={step.done}
                                                            onClick={() => toggle(step)}
                                                        >
                                                            <span className="cookplan__box" aria-hidden="true">
                                                                {step.done && <GiCheckMark />}
                                                            </span>
                                                            <span className="cookplan__at">{clockLabel(step.at_time)}</span>
                                                            <span className="cookplan__what">
                                                                {step.what}
                                                                <span className="cookplan__meta">
                                                                    {step.dish && <span className="cookplan__dish">{step.dish}</span>}
                                                                    {step.minutes > 0 && (
                                                                        <span className={step.waiting ? 'cookplan__waiting' : ''}>
                                                                            {step.waiting ? 'waits ' : ''}{lengthLabel(step.minutes)}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </span>
                                                        </button>
                                                        <span className="cookplan__step-actions">
                                                            <Button
                                                                icon
                                                                size="sm"
                                                                label={`Edit: ${step.what}`}
                                                                onClick={() => startEdit(step)}
                                                            >
                                                                <GiPencil />
                                                            </Button>
                                                            <Button
                                                                icon
                                                                size="sm"
                                                                label={`Remove: ${step.what}`}
                                                                onClick={() => removeStep(step.id)}
                                                            >
                                                                <GiTrashCan />
                                                            </Button>
                                                        </span>
                                                    </>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ))}
                        </div>

                        {editing === 'new'
                            ? <div className="cookplan__day">{editor}</div>
                            : <Button size="sm" onClick={startNew}>Add a step</Button>}
                    </>
                )}
            </div>
        </Modal>
    );
};

export default CookPlan;
