import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { GiSunrise, GiTrashCan, GiPlainCircle } from 'react-icons/gi';
import { Button, Card, Field } from './ui';
import { useTripDays } from '../hooks/useTripDays';
import { COST_BUCKETS, formatMoney } from '../utils/tripCosts';
import { describeCode, dressFor, sourceLabel } from '../utils/weather';
import TripTimeline from './TripTimeline';
import TripStays from './TripStays';
import TripRoute from './TripRoute';

/**
 * The spreadsheet, made to think.
 *
 * The sheet had a column per day, an hour per row, three side columns for
 * things to do / food / other, and five cost lines footing to a per-person
 * running total. Everything in it was typed by hand, including the weather and
 * including the division of a shared cost by the number of people going.
 *
 * Here the same shape is one card per day. What is different: costs know
 * whether they are shared, so changing the party size re-does the arithmetic;
 * a planned thing can carry its own price and roll up into the day's bucket;
 * and the weather fills itself in.
 */

const BUCKET_LABEL = {
    lodging: 'Lodging',
    food: 'Food',
    excursions: 'Excursions',
    transport: 'Transport',
    points: 'Points',
};

const KINDS = [
    { value: 'todo', label: 'To do' },
    { value: 'food', label: 'Food' },
    { value: 'lodging', label: 'Lodging' },
    { value: 'transport', label: 'Transport' },
    { value: 'other', label: 'Other' },
];

const WeatherChip = ({ weather }) => {
    if (!weather) return <span className="trip-day__weather is-empty">No weather yet</span>;
    const { label, icon } = describeCode(weather.code);
    const dress = dressFor(weather.high, weather.low);
    return (
        <span className="trip-day__weather" title={sourceLabel(weather) || ''}>
            <span aria-hidden="true">{icon}</span>
            <strong>
                {weather.high != null ? `${Math.round(weather.high)}°` : '—'}
                {weather.low != null && <span className="trip-day__low"> / {Math.round(weather.low)}°</span>}
            </strong>
            <span className="trip-day__conditions">{label}</span>
            {/* An average is not a forecast, and the difference decides what
                goes in the suitcase. */}
            {weather.source === 'normal' && <em className="trip-day__typical">typical</em>}
            {dress && <span className="trip-day__dress">{dress}</span>}
        </span>
    );
};

const DayItem = ({ item, currency, onChange, onDelete }) => (
    <li className="trip-item">
        <input
            type="time"
            className="trip-item__time"
            value={item.start_time ? String(item.start_time).slice(0, 5) : ''}
            aria-label="Time"
            onChange={(e) => onChange({ start_time: e.target.value || null })}
        />
        <input
            type="text"
            className="trip-item__title"
            value={item.title || ''}
            aria-label="What"
            onChange={(e) => onChange({ title: e.target.value })}
        />
        <select
            className="trip-item__kind"
            value={item.kind}
            aria-label="Kind"
            onChange={(e) => onChange({ kind: e.target.value })}
        >
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <input
            type="number"
            inputMode="decimal"
            className="trip-item__cost"
            placeholder={currency === 'USD' ? '$' : currency}
            value={item.cost ?? ''}
            aria-label="Cost"
            onChange={(e) => onChange({ cost: e.target.value === '' ? null : e.target.value })}
        />
        <button
            type="button"
            className={`trip-item__split${item.cost_shared === false ? '' : ' is-shared'}`}
            title={item.cost_shared === false ? 'Each person pays this' : 'Split across the party'}
            onClick={() => onChange({ cost_shared: item.cost_shared === false })}
        >
            {item.cost_shared === false ? 'each' : 'split'}
        </button>
        <button type="button" className="trip-item__drop" aria-label="Remove" onClick={onDelete}>
            <GiTrashCan />
        </button>
    </li>
);

const TripPlanner = ({ trip, onUpdateTrip }) => {
    const {
        days, items, stays, legs, strays, tripDates, costs, weatherBusy, weatherMessage,
        lodgingPerNight, stayOnDate, addStay, updateStay, deleteStay,
        legOnDate, addLeg, updateLeg, deleteLeg,
        ensureDays, updateDay, addItem, updateItem, deleteItem, refreshWeather,
    } = useTripDays(trip);

    const [draft, setDraft] = useState({});
    // Three views, because they answer three different questions. Route is the
    // default: you decide the shape of a trip before you decide what to do on
    // its Tuesday, and until now there was nowhere to do that.
    const [view, setView] = useState('route');
    const currency = trip?.currency || 'USD';
    const party = trip?.party_size || 1;

    // Days follow the trip's dates rather than being made by hand.
    useEffect(() => { ensureDays(); }, [ensureDays]);

    const byId = Object.fromEntries(costs.days.map((d) => [d.id, d]));

    if (!trip?.start_date) {
        return (
            <Card className="trip-planner__empty">
                <p>Give this trip a start date and the days will lay themselves out.</p>
            </Card>
        );
    }

    return (
        <div className="trip-planner">
            <Card className="trip-planner__summary">
                <div className="trip-planner__totals">
                    <div>
                        <span className="trip-planner__figure">{formatMoney(costs.perPerson, currency)}</span>
                        <span className="trip-planner__caption">per person</span>
                    </div>
                    <div>
                        <span className="trip-planner__figure">{formatMoney(costs.party, currency)}</span>
                        <span className="trip-planner__caption">
                            for {party} {party === 1 ? 'person' : 'people'}
                        </span>
                    </div>
                    <label className="trip-planner__party">
                        <span>Party</span>
                        <input
                            type="number"
                            min="1"
                            value={party}
                            onChange={(e) => onUpdateTrip?.(trip.id, {
                                party_size: Math.max(1, Number(e.target.value) || 1),
                            })}
                        />
                    </label>
                    <Button onClick={refreshWeather} disabled={weatherBusy}>
                        <GiSunrise /> {weatherBusy ? 'Checking…' : 'Fill in weather'}
                    </Button>

                    <div className="trip-planner__views" role="group" aria-label="View">
                        {['route', 'timeline', 'cards'].map((v) => (
                            <button
                                key={v}
                                type="button"
                                className={`trip-planner__view${view === v ? ' is-on' : ''}`}
                                aria-pressed={view === v}
                                onClick={() => setView(v)}
                            >
                                {v === 'route' ? 'Route' : v === 'cards' ? 'Cards' : 'Timeline'}
                            </button>
                        ))}
                    </div>
                </div>

                {weatherMessage && <p className="trip-planner__note">{weatherMessage}</p>}

                <ul className="trip-planner__buckets">
                    {COST_BUCKETS.map((b) => (
                        <li key={b}>
                            <span>{BUCKET_LABEL[b]}</span>
                            <strong>{formatMoney(costs.totals[b], currency)}</strong>
                        </li>
                    ))}
                </ul>
            </Card>

            <TripStays
                stays={stays}
                currency={currency}
                partySize={party}
                tripStart={trip.start_date}
                tripEnd={trip.end_date}
                onAdd={addStay}
                onUpdate={updateStay}
                onDelete={deleteStay}
            />

            {/* A day left over from an earlier set of dates, still holding
                something. Empty ones are cleared automatically; these are not,
                because they are evidence of a plan. */}
            {strays.length > 0 && (
                <p className="trip-planner__strays">
                    {strays.length} {strays.length === 1 ? 'day sits' : 'days sit'} outside
                    the trip’s dates but still {strays.length === 1 ? 'has' : 'have'} things in
                    {strays.length === 1 ? ' it' : ' them'}: {strays.map((d) => String(d.date).slice(0, 10)).join(', ')}.
                </p>
            )}

            {view === 'route' ? (
                <TripRoute
                    legs={legs}
                    stays={stays}
                    days={days}
                    items={items}
                    costs={costs}
                    currency={currency}
                    tripDates={tripDates}
                    onAdd={addLeg}
                    onUpdate={updateLeg}
                    onDelete={deleteLeg}
                />
            ) : view === 'timeline' ? (
                <TripTimeline
                    days={days}
                    items={items}
                    stays={stays}
                    legs={legs}
                    costs={costs}
                    currency={currency}
                />
            ) : (
            <div className="trip-planner__days">
                {days.map((day) => {
                    const money = byId[day.id] || { buckets: {}, total: 0, runningTotal: 0 };
                    const dayItems = items[day.id] || [];
                    const key = `${day.id}-new`;

                    return (
                        <Card key={day.id} className="trip-day">
                            <header className="trip-day__head">
                                <h3>{format(parseISO(String(day.date).slice(0, 10)), 'EEE d MMM')}</h3>
                                <WeatherChip weather={day.weather} />
                            </header>

                            <div className="trip-day__where">
                                {/* Decided once in the Route view, for the whole
                                    leg, rather than asked again every day. */}
                                {legOnDate(day.date) ? (
                                    <div className="trip-day__stay">
                                        <span className="field__label">City</span>
                                        <p>{legOnDate(day.date).city}</p>
                                    </div>
                                ) : (
                                    <Field
                                        label="City"
                                        value={day.city || ''}
                                        onChange={(e) => updateDay(day.id, { city: e.target.value })}
                                    />
                                )}
                                {/* Where a booking covers this night, it says so
                                    rather than asking for the name again. */}
                                {stayOnDate(day.date) ? (
                                    <div className="trip-day__stay">
                                        <span className="field__label">Lodging</span>
                                        <p>
                                            {stayOnDate(day.date).name}
                                            <em>
                                                {formatMoney(
                                                    (lodgingPerNight[String(day.date).slice(0, 10)] || 0) / 100,
                                                    currency
                                                )} / night
                                            </em>
                                        </p>
                                    </div>
                                ) : (
                                    <Field
                                        label="Lodging"
                                        value={day.lodging || ''}
                                        onChange={(e) => updateDay(day.id, { lodging: e.target.value })}
                                    />
                                )}
                            </div>

                            <ul className="trip-day__items">
                                {dayItems.map((item) => (
                                    <DayItem
                                        key={item.id}
                                        item={item}
                                        currency={currency}
                                        onChange={(patch) => updateItem(day.id, item.id, patch)}
                                        onDelete={() => deleteItem(day.id, item.id)}
                                    />
                                ))}
                            </ul>

                            <form
                                className="trip-day__add"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const title = (draft[key] || '').trim();
                                    if (!title) return;
                                    addItem(day.id, { title, kind: 'todo' });
                                    setDraft((prev) => ({ ...prev, [key]: '' }));
                                }}
                            >
                                <input
                                    type="text"
                                    placeholder="Add something to this day…"
                                    value={draft[key] || ''}
                                    onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                                />
                            </form>

                            <div className="trip-day__costs">
                                <label className="trip-day__shared">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(day.costs_are_shared)}
                                        onChange={(e) => updateDay(day.id, { costs_are_shared: e.target.checked })}
                                    />
                                    {/* The single most useful switch here: the sheet
                                        made you divide by hand before typing. */}
                                    <span>These figures are for the whole party</span>
                                </label>

                                {COST_BUCKETS.map((b) => (
                                    <label key={b} className="trip-day__cost">
                                        <span>{BUCKET_LABEL[b]}</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={day[`cost_${b}`] ?? ''}
                                            onChange={(e) => updateDay(day.id, {
                                                [`cost_${b}`]: e.target.value === '' ? 0 : e.target.value,
                                            })}
                                        />
                                        <em>{formatMoney(money.buckets[b] || 0, currency)}</em>
                                    </label>
                                ))}

                                <p className="trip-day__total">
                                    <span><GiPlainCircle /> This day</span>
                                    <strong>{formatMoney(money.total, currency)}</strong>
                                </p>
                                <p className="trip-day__running">
                                    <span>Running total</span>
                                    <strong>{formatMoney(money.runningTotal, currency)}</strong>
                                </p>
                            </div>
                        </Card>
                    );
                })}
            </div>
            )}
        </div>
    );
};

export default TripPlanner;
