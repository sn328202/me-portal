import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { GiTrashCan, GiPathDistance, GiKnot } from 'react-icons/gi';
import { Button, Card } from './ui';
import { formatMoney } from '../utils/tripCosts';
import { summariseLegs, routeGaps, isTravelLeg, legDestination } from '../utils/tripLegs';

/**
 * The trip before it is days: five in Goa, then four in Kerala.
 *
 * You cannot plan a Tuesday until you know which city the Tuesday is in, and
 * the day cards could not tell you that — every one of them asked for a city
 * as if it were an independent question. This is the view where the shape gets
 * decided, and then the days inherit it.
 *
 * The gaps panel is the point. "Which nights have I not booked anywhere?" is
 * answerable only by opening every day card in turn, which means in practice it
 * is not answered until something goes wrong.
 */

const TripRoute = ({
    legs, stays, days, items, costs, currency, tripDates,
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
    const gaps = routeGaps(tripDates, legs, stays);

    const pretty = (d) => format(parseISO(String(d).slice(0, 10)), 'd MMM');

    const submit = (e) => {
        e.preventDefault();
        if (!draft.city.trim() || !draft.start_date || !draft.end_date) return;
        if (draft.end_date < draft.start_date) return;
        onAdd({ ...draft, city: draft.city.trim() });
        setDraft({ city: '', start_date: '', end_date: '' });
        setAdding(false);
    };

    // Handovers are deliberately not counted: they are a fact about the trip,
    // not something to go and fix.
    const problems = gaps.unassigned.length + gaps.overlaps.length + gaps.unhoused.length;

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
                            <input
                                type="date"
                                value={String(leg.start_date).slice(0, 10)}
                                aria-label="Arrive"
                                onChange={(e) => onUpdate(leg.id, { start_date: e.target.value })}
                            />
                            <input
                                type="date"
                                value={String(leg.end_date).slice(0, 10)}
                                aria-label="Leave"
                                onChange={(e) => onUpdate(leg.id, { end_date: e.target.value })}
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

            {/* Three different failures, named separately, because the fix for
                each is different. */}
            <Card className={`route__gaps${problems ? '' : ' is-clear'}`}>
                <h4><GiKnot /> {problems ? 'Loose ends' : 'Nothing loose'}</h4>

                {!problems && (
                    <p>Every day has a city, and every night has somewhere to sleep.</p>
                )}

                {gaps.unassigned.length > 0 && (
                    <p>
                        <strong>{gaps.unassigned.length}</strong>{' '}
                        {gaps.unassigned.length === 1 ? 'day has' : 'days have'} no city yet —{' '}
                        {gaps.unassigned.map(pretty).join(', ')}
                    </p>
                )}

                {gaps.unhoused.length > 0 && (
                    <p className="route__warn">
                        <strong>{gaps.unhoused.length}</strong>{' '}
                        {gaps.unhoused.length === 1 ? 'night has' : 'nights have'} nowhere booked —{' '}
                        {gaps.unhoused.map(pretty).join(', ')}
                    </p>
                )}

                {gaps.overlaps.length > 0 && (
                    <p className="route__warn">
                        Two cities claim {gaps.overlaps.map(pretty).join(', ')}. You can only be
                        in one.
                    </p>
                )}

                {/* Said plainly rather than warned about: a day that ends in one
                    city and finishes in another is a normal way to travel. */}
                {gaps.handovers.length > 0 && (
                    <p className="route__note">
                        {gaps.handovers.length} travel {gaps.handovers.length === 1 ? 'day' : 'days'}
                        {' '}— {gaps.handovers.map(pretty).join(', ')} — where you change cities.
                    </p>
                )}
            </Card>
        </div>
    );
};

export default TripRoute;
