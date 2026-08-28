import React, { useState } from 'react';
import { GiTrashCan, GiPathDistance } from 'react-icons/gi';
import { Button, Card } from './ui';
import { formatMoney } from '../utils/tripCosts';
import { summariseLegs, isTravelLeg, legDestination } from '../utils/tripLegs';
import DateField from './DateField';

/**
 * The trip before it is days: five in Goa, then four in Kerala.
 *
 * You cannot plan a Tuesday until you know which city the Tuesday is in, and
 * the day cards could not tell you that — every one of them asked for a city
 * as if it were an independent question. This is the view where the shape gets
 * decided, and then the days inherit it.
 *
 * What is *not* here any more is the gaps panel. It used to sit under this
 * list, where halfway up the page it read as the next step — a thing to fix
 * before carrying on. It is a checklist you glance at once the planning is
 * done, so it lives at the bottom now, as TripLooseEnds.
 */

const TripRoute = ({
    legs, stays, days, items, costs, currency,
    onAdd, onUpdate, onDelete,
}) => {
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState({ city: '', start_date: '', end_date: '' });

    const weatherByDate = Object.fromEntries(
        days.map((d) => [String(d.date).slice(0, 10), d.weather]).filter(([, w]) => w)
    );
    const costsByDate = Object.fromEntries(
        (costs?.days || []).map((d) => [String(d.date).slice(0, 10), d.total])
    );
    const itemsByDate = Object.fromEntries(
        days.map((d) => [String(d.date).slice(0, 10), items[d.id] || []])
    );

    const summary = summariseLegs(legs, { itemsByDate, costsByDate, weatherByDate, stays });

    const submit = (e) => {
        e.preventDefault();
        if (!draft.city.trim() || !draft.start_date || !draft.end_date) return;
        if (draft.end_date < draft.start_date) return;
        onAdd({ ...draft, city: draft.city.trim() });
        setDraft({ city: '', start_date: '', end_date: '' });
        setAdding(false);
    };

    return (
        <div className="route">
            <Card className="route__legs">
                <header className="route__head">
                    <h4><GiPathDistance /> Where, and when</h4>
                    <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
                        {adding ? 'Cancel' : '+ Add a city'}
                    </Button>
                </header>

                {!summary.length && !adding && (
                    <p className="route__empty">
                        No cities yet. Add one and its days fill themselves in.
                    </p>
                )}

                <ol className="route__list">
                    {summary.map(({ leg, days: dayCount, nights, high, low, cost, planned, lodging }) => (
                        <li key={leg.id} className="route__leg">
                            <input
                                type="text"
                                className="route__city"
                                value={leg.city}
                                aria-label="City"
                                onChange={(e) => onUpdate(leg.id, { city: e.target.value })}
                            />
                            <DateField
                                value={leg.start_date}
                                aria-label="Arrive"
                                onCommit={(v) => onUpdate(leg.id, { start_date: v || null })}
                            />
                            <DateField
                                value={leg.end_date}
                                aria-label="Leave"
                                onCommit={(v) => onUpdate(leg.id, { end_date: v || null })}
                            />

                            <span className="route__facts">
                                <span>
                                    {dayCount} {dayCount === 1 ? 'day' : 'days'} · {nights} {nights === 1 ? 'night' : 'nights'}
                                    {/* Named, not hidden: it is three days of
                                        packing like any other leg. */}
                                    {isTravelLeg(leg) && (
                                        <em className="route__travel">
                                            travelling{legDestination(leg, legs) ? ` to ${legDestination(leg, legs)}` : ''}
                                        </em>
                                    )}
                                </span>
                                {high != null && <span className="route__temp">avg {high}° / {low}°</span>}
                                <span className={lodging.length ? 'route__ok' : 'route__warn'}>
                                    {lodging.length
                                        ? lodging.map((s) => s.name).join(', ')
                                        : 'nowhere booked'}
                                </span>
                                <span>{planned} planned</span>
                            </span>

                            <strong className="route__cost">{formatMoney(cost, currency)}</strong>

                            <button
                                type="button"
                                className="route__drop"
                                aria-label={`Remove ${leg.city}`}
                                onClick={() => onDelete(leg.id)}
                            >
                                <GiTrashCan />
                            </button>
                        </li>
                    ))}
                </ol>

                {adding && (
                    <form className="route__add" onSubmit={submit}>
                        <input
                            type="text"
                            placeholder="City…"
                            autoFocus
                            value={draft.city}
                            onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                        />
                        <input
                            type="date"
                            aria-label="Arrive"
                            value={draft.start_date}
                            onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                        />
                        <input
                            type="date"
                            aria-label="Leave"
                            min={draft.start_date || undefined}
                            value={draft.end_date}
                            onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                        />
                        <Button type="submit" variant="solid" size="sm">Add</Button>
                    </form>
                )}
            </Card>
        </div>
    );
};

export default TripRoute;
