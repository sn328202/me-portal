import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { GiTrashCan, GiPlainCircle } from 'react-icons/gi';
import { Button, Card, ConfirmButton, Field } from './ui';
import { COST_BUCKETS, formatMoney } from '../utils/tripCosts';
import { describeCode, dressFor, sourceLabel } from '../utils/weather';
import TripTimeline from './TripTimeline';
import StopPopover from './StopPopover';
import TripStays from './TripStays';
import MentionInput from './MentionInput';
import { isTravelLeg } from '../utils/tripLegs';

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

/* Which pile of the ideas board lands as which kind of plan. */
const IDEA_KIND = { do: 'todo', eat: 'food', stay: 'lodging' };

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

/**
 * One stop on a day.
 *
 * A stop that came from an itinerary is shown, not edited. The itinerary is
 * where it is decided — that is what "linked" means, and it was already true
 * silently: editing one here got overwritten the next time she touched the
 * itinerary. Locking it says so, and the link goes to the place where the
 * edit will actually stick.
 */
/**
 * A stop, as the overview shows it.
 *
 * This used to be a row of six live form controls — a time input, a name box,
 * a kind select, a cost field, a split toggle and a delete — repeated for
 * every stop of every day. Which meant the Atlas was a second editing surface
 * for the same rows the Day Builder edits, with its own set of things that
 * could be half-saved, and a day card that was mostly chrome.
 *
 * It reads now. Clicking it opens the one stop, which is the small job;
 * "Build this day" at the top of the card opens the whole day, which is the
 * large one. Two surfaces, not three.
 */
const DayItem = ({ item, currency, onOpen, onDelete }) => (
    <li className="trip-item trip-item--read">
        <button
            type="button"
            className="trip-item__row"
            onClick={onOpen}
            aria-label={`Edit ${item.title || 'this stop'}`}
        >
            <span className="trip-item__time trip-item__time--fixed">
                {item.start_time ? String(item.start_time).slice(0, 5) : '--:--'}
            </span>
            <span className="trip-item__title trip-item__title--fixed">{item.title}</span>
        </button>

        {item.link && (
            <a
                className="trip-item__link"
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                title={item.location || 'Open the map'}
                aria-label={`Open ${item.title || 'this'} on the map`}
            >
                ↗
            </a>
        )}
        <span className="trip-item__kind trip-item__kind--fixed">
            {KINDS.find((k) => k.value === item.kind)?.label || item.kind}
        </span>
        <span className="trip-item__cost trip-item__cost--fixed">
            {item.cost == null || item.cost === '' ? '' : formatMoney(item.cost, currency)}
        </span>
        <span className={`trip-item__split${item.cost_shared === false ? '' : ' is-shared'}`}>
            {item.cost_shared === false ? 'each' : 'split'}
        </span>
        {/* Until Stage 5 retires the Daydream, a stop that came from an
            itinerary still says where it came from. */}
        {item.from_plan_id && (
            <a
                className="trip-item__source"
                href={`/daydream?plan=${item.from_plan_id}`}
                title="This came from an itinerary — edit it there"
                onClick={(e) => e.stopPropagation()}
            >
                ✎ itinerary
            </a>
        )}
        <button type="button" className="trip-item__drop" aria-label="Remove" onClick={onDelete}>
            <GiTrashCan />
        </button>
    </li>
);

/* Two ways of looking at the same days, and that is all this is.

   It had four entries. Setup was never a view of the days — it is the sheet
   links, the photo album and the budget, opened about twice a trip; it is a
   button now. And Route was never a view of the days either: it is the cities
   and the dates they run between, which is what the days are *made out of*.
   It lives in the overview, next to Fill in weather, because those cities and
   those dates are precisely what the weather is looked up from. */
const VIEWS = [
    { value: 'timeline', label: 'Timeline' },
    { value: 'cards', label: 'Cards' },
];

const TripPlanner = ({ trip, onUpdateTrip, planner, onIdeaUsed }) => {
    const {
        days, items, stays, legs, strays, costs,
        lodgingPerNight, stayOnDate, addStay, updateStay, deleteStay,
        legOnDate, cityLabelFor, moveItem,
        ensureDays, updateDay, addItem, updateItem, deleteItem,
        dropDay,
    // Lifted to the page so the spreadsheet export and the Wardrobe handoff
    // read the same trip this is showing, rather than fetching a second copy.
    } = planner;

    const [draft, setDraft] = useState({});
    /* Which stop is open for a quick edit, and where its @-search should look.
       One stop is a small job and gets a small surface; the whole day is a
       different job and has its own page. */
    const [editing, setEditing] = useState(null);
    // Four views, because they answer four different questions. Route is the
    // default: you decide the shape of a trip before you decide what to do on
    // its Tuesday, and until now there was nowhere to do that.
    //
    // Setup is the fourth because the sheet links, the photos album and the
    // budget used to sit in a permanent right-hand column, and a column you
    // open twice a trip was costing the timeline a sixth of the page on every
    // other day of it.
    const [view, setView] = useState('timeline');
    const currency = trip?.currency || 'USD';
    const party = trip?.party_size || 1;

    // Days follow the trip's dates rather than being made by hand.
    useEffect(() => { ensureDays(); }, [ensureDays]);

    const byId = Object.fromEntries(costs.days.map((d) => [d.id, d]));

    if (!trip?.start_date) {
        return (
            <Card className="trip-planner__empty">
                <p>Give this trip a start date and the days will lay themselves out.</p>
                <p>
                    Or bring one you already have: <strong>Setup</strong>, at the top of the
                    page, imports a whole itinerary from a spreadsheet.
                </p>
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
                    {/* The view toggle used to be here, at the top of a card
                        two sections above the thing it switched — which is why
                        pressing it looked like it was changing the trip's
                        details rather than the days below them. It sits
                        directly on top of what it controls now. */}
                </div>

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
                <div className="trip-planner__strays">
                    <p>
                        {strays.length} {strays.length === 1 ? 'day sits' : 'days sit'} outside
                        the trip’s dates but still {strays.length === 1 ? 'has' : 'have'} things in
                        {strays.length === 1 ? ' it' : ' them'}. Shortening the dates will not
                        throw away a plan — say so here and it goes.
                    </p>
                    <ul>
                        {strays.map((d) => (
                            <li key={d.id}>
                                <span>{format(parseISO(String(d.date).slice(0, 10)), 'EEE d MMM')}</span>
                                <em>
                                    {(items[d.id] || []).length}
                                    {(items[d.id] || []).length === 1 ? ' thing' : ' things'}
                                </em>
                                <ConfirmButton
                                    size="sm"
                                    label={`Remove ${String(d.date).slice(0, 10)}`}
                                    confirmLabel="Delete it and everything on it?"
                                    onConfirm={() => dropDay(d.id)}
                                >
                                    Remove
                                </ConfirmButton>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Directly on top of what it switches. Setup used to sit here
                too; it is in the page header now, because importing an
                existing itinerary is where a trip *starts* and this whole
                component refuses to render until the trip has dates. */}
            <div className="trip-planner__switch">
                <div className="trip-planner__views" role="group" aria-label="View">
                    {VIEWS.map((v) => (
                        <button
                            key={v.value}
                            type="button"
                            className={`trip-planner__view${view === v.value ? ' is-on' : ''}`}
                            aria-pressed={view === v.value}
                            onClick={() => setView(v.value)}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>

            {view === 'timeline' ? (
                <>
                    <TripTimeline
                        tripId={trip?.id}
                        days={days}
                        items={items}
                        stays={stays}
                        legs={legs}
                        costs={costs}
                        currency={currency}
                        onCreate={(dayId, times) => addItem(dayId, {
                            title: 'New plan', kind: 'todo', ...times,
                        })}
                        onOpen={(dayId, item, near) => setEditing({ dayId, id: item.id, near })}
                        onRecolour={(dayId, id, colour) => updateItem(dayId, id, { colour })}
                        onDelete={deleteItem}
                        onMove={moveItem}
                        onDropIdea={async (dayId, times, idea) => {
                            await addItem(dayId, {
                                title: idea.title,
                                // An idea's pile is its bucket: somewhere to
                                // eat becomes food, and adds up with the food.
                                kind: IDEA_KIND[idea.kind] || 'todo',
                                cost: idea.cost ?? null,
                                link: idea.url || null,
                                location: idea.area || null,
                                ...times,
                            });
                            // The idea stays on the board, dimmed: the note
                            // saying why it was worth doing does not fit in a
                            // day item, and is often the useful half.
                            await onIdeaUsed?.(idea.id);
                        }}
                    />

                </>
            ) : (
            <div className="trip-planner__days">
                {days.map((day) => {
                    const money = byId[day.id] || { buckets: {}, total: 0, runningTotal: 0 };
                    const dayItems = items[day.id] || [];
                    const key = `${day.id}-new`;
                    /* Where the search should look. A travel day has no city
                       of its own worth biasing towards — you are in the air. */
                    const leg = legOnDate(day.date);
                    const near = leg && !isTravelLeg(leg)
                        ? { city: leg.city, lat: leg.lat, lng: leg.lng, radiusKm: 30 }
                        : (day.city ? { city: day.city } : null);

                    return (
                        <Card key={day.id} className="trip-day">
                            <header className="trip-day__head">
                                <h3>{format(parseISO(String(day.date).slice(0, 10)), 'EEE d MMM')}</h3>
                                <WeatherChip weather={day.weather} />
                                {/* This view is an overview of what was
                                    built. The building happens on the day's
                                    own page, which has room for it. */}
                                <Link
                                    className="trip-day__build"
                                    to={`/atlas/${trip.id}/day/${String(day.date).slice(0, 10)}`}
                                >
                                    Build this day →
                                </Link>
                            </header>

                            <div className="trip-day__where">
                                {/* Decided once in the Route view, for the whole
                                    leg, rather than asked again every day. */}
                                {legOnDate(day.date) ? (
                                    <div className="trip-day__stay">
                                        <span className="field__label">City</span>
                                        {/* On a travel day both cities are true,
                                            and which one you are in depends on
                                            the hour. */}
                                        <p>{cityLabelFor(day.date)}</p>
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
                                        onOpen={() => setEditing({ dayId: day.id, id: item.id, near })}
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
                                <MentionInput
                                    placeholder="Add something to this day…"
                                    value={draft[key] || ''}
                                    aria-label="Add something to this day"
                                    near={near}
                                    onChange={(text) => setDraft((prev) => ({ ...prev, [key]: text }))}
                                    /* Picked from the menu, the plan is made
                                       there and then with its link, rather
                                       than waiting for an Enter that would
                                       lose the place it just found. */
                                    onPick={(place, text) => {
                                        addItem(day.id, {
                                            title: text.trim() || place.name,
                                            kind: 'todo',
                                            link: place.maps_url || null,
                                            location: place.address || null,
                                        });
                                        setDraft((prev) => ({ ...prev, [key]: '' }));
                                    }}
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

            {/* One stop, edited where you found it — from either view, because
                both views are now overviews of the same rows. */}
            {editing && (
                <StopPopover
                    item={(items[editing.dayId] || []).find((i) => i.id === editing.id)}
                    dayId={editing.dayId}
                    date={days.find((d) => d.id === editing.dayId)?.date}
                    tripId={trip?.id}
                    near={editing.near}
                    onChange={updateItem}
                    onDelete={deleteItem}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
};

export default TripPlanner;
