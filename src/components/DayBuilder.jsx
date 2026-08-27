import React, { useState } from 'react';
import { GiCompass, GiPositionMarker, GiCheckMark, GiPathDistance, GiWalk, GiCarWheel } from 'react-icons/gi';
import { Button, Card, Field, Tag, EmptyState } from './ui';
import SpotsMap from './SpotsMap';
import { useItinerary } from '../hooks/useItinerary';
import '../styles/DayBuilder.css';

/**
 * "A day in Napa."
 *
 * Type a place; everything already saved inside it comes back nearest-first,
 * plus places nearby that are not saved yet. Tick what you want and it becomes
 * an itinerary ordered so the day does not criss-cross.
 *
 * The radius comes from the area's own bounding box, so a neighbourhood
 * searches a neighbourhood and a wine region searches a region.
 */
const DayBuilder = ({ onOpenPlan }) => {
    const {
        area, spots, suggestions, suggestionsAvailable,
        searching, building, error, result, search, build, reset,
    } = useItinerary();

    const [near, setNear] = useState('');
    const [keyword, setKeyword] = useState('');
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [chosen, setChosen] = useState(() => new Set());
    const [chosenNew, setChosenNew] = useState(() => new Set());

    const toggle = (set, setter, id) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id); else next.add(id);
        setter(next);
    };

    const onSearch = (e) => {
        e.preventDefault();
        setChosen(new Set());
        setChosenNew(new Set());
        setTitle('');
        search(near, keyword);
    };

    const total = chosen.size + chosenNew.size;

    const onBuild = async () => {
        const plan = await build({
            title: title.trim() || `A day in ${area?.name || near}`,
            date: date || null,
            near: area?.name || near,
            spotIds: [...chosen],
            newPlaces: suggestions.filter((s) => chosenNew.has(s.place_id || s.name)),
        });
        if (plan?.planId && onOpenPlan) onOpenPlan(plan.planId);
    };

    return (
        <div className="day-builder">
            <form className="day-builder__search" onSubmit={onSearch}>
                <Field
                    label="Where?"
                    type="text"
                    placeholder="Napa, or Hayes Valley San Francisco"
                    value={near}
                    onChange={(e) => setNear(e.target.value)}
                />
                <Field
                    label="Looking for (optional)"
                    type="text"
                    placeholder="wineries, coffee, bookshops"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                />
                <Button type="submit" variant="primary" disabled={!near.trim() || searching}>
                    {searching ? 'Looking…' : 'Find my places'}
                </Button>
            </form>

            {error && <p className="day-builder__error">{error}</p>}

            {area && (
                <>
                    <p className="day-builder__area">
                        <GiCompass aria-hidden="true" /> <strong>{area.name}</strong>
                        {' — searching '}{area.radiusKm}km around it
                        <Button size="sm" variant="ghost" onClick={reset}>Clear</Button>
                    </p>

                    <SpotsMap
                        spots={[...spots, ...suggestions.map((s, i) => ({ ...s, id: `sugg-${i}`, status: 'suggestion' }))]}
                        focus={area}
                        height="22rem"
                    />
                </>
            )}

            {area && (
                <div className="day-builder__columns">
                    <section>
                        <h3 className="day-builder__heading">
                            Yours here <span className="muted">({spots.length})</span>
                        </h3>

                        {spots.length === 0 ? (
                            <EmptyState
                                inline
                                icon={<GiPositionMarker />}
                                message="Nothing saved around here yet."
                                hint="Pick from the suggestions, or save places as you find them."
                            />
                        ) : (
                            <ul className="day-builder__list">
                                {spots.map((spot) => (
                                    <li key={spot.id}>
                                        <button
                                            type="button"
                                            className={`pick${chosen.has(spot.id) ? ' pick--on' : ''}`}
                                            role="checkbox"
                                            aria-checked={chosen.has(spot.id)}
                                            onClick={() => toggle(chosen, setChosen, spot.id)}
                                        >
                                            <span className="pick__box" aria-hidden="true">
                                                {chosen.has(spot.id) && <GiCheckMark />}
                                            </span>
                                            <span className="pick__body">
                                                <span className="pick__name">{spot.name}</span>
                                                <span className="pick__meta">
                                                    {spot.category && <Tag>{spot.category}</Tag>}
                                                    {spot.distanceKm != null && <span>{spot.distanceKm}km</span>}
                                                    {spot.rating && <span>★ {Number(spot.rating).toFixed(1)}</span>}
                                                    {spot.status === 'been' && <span>been</span>}
                                                </span>
                                                {spot.why && <span className="pick__why">“{spot.why}”</span>}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section>
                        <h3 className="day-builder__heading">
                            Add more <span className="muted">({suggestions.length})</span>
                        </h3>

                        {!suggestionsAvailable ? (
                            <p className="muted day-builder__note">
                                Suggestions need a Google Places key on the server. Everything else
                                works without it.
                            </p>
                        ) : suggestions.length === 0 ? (
                            <p className="muted day-builder__note">Nothing new to suggest here.</p>
                        ) : (
                            <ul className="day-builder__list">
                                {suggestions.map((place, i) => {
                                    const id = place.place_id || place.name;
                                    return (
                                        <li key={id || i}>
                                            <button
                                                type="button"
                                                className={`pick${chosenNew.has(id) ? ' pick--on' : ''}`}
                                                role="checkbox"
                                                aria-checked={chosenNew.has(id)}
                                                onClick={() => toggle(chosenNew, setChosenNew, id)}
                                            >
                                                <span className="pick__box" aria-hidden="true">
                                                    {chosenNew.has(id) && <GiCheckMark />}
                                                </span>
                                                <span className="pick__body">
                                                    <span className="pick__name">{place.name}</span>
                                                    <span className="pick__meta">
                                                        {place.category && <Tag>{place.category}</Tag>}
                                                        {place.rating && <span>★ {Number(place.rating).toFixed(1)}</span>}
                                                        {place.price_level ? <span>{'$'.repeat(place.price_level)}</span> : null}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            )}

            {total > 0 && !result && (
                <Card variant="flat" className="day-builder__commit">
                    <div className="day-builder__commit-fields">
                        <Field
                            label="Call it"
                            type="text"
                            placeholder={`A day in ${area?.name || near}`}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <Field
                            label="Date (optional)"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <Button variant="primary" onClick={onBuild} disabled={building}>
                        {building ? 'Working out the route…' : `Build the day (${total} stop${total > 1 ? 's' : ''})`}
                    </Button>
                </Card>
            )}

            {result?.ok && (
                <Card variant="flat" className="day-builder__result">
                    <h3 className="day-builder__heading">
                        <GiPathDistance aria-hidden="true" /> {result.title}
                    </h3>
                    <p className="muted">
                        {result.stops.length} stops, about {result.totalKm}km of moving about
                        {result.savedNew > 0 && ` — ${result.savedNew} new place${result.savedNew > 1 ? 's' : ''} saved to Spots`}
                    </p>
                    <ol className="day-builder__route">
                        {result.stops.map((stop, i) => {
                            const leg = i > 0 ? result.legs[i - 1] : null;
                            return (
                                <li key={stop.id}>
                                    {leg && (
                                        <span className="day-builder__leg">
                                            {leg.mode === 'walk' ? <GiWalk /> : <GiCarWheel />} {leg.minutes} min
                                        </span>
                                    )}
                                    <span className="day-builder__stop">{stop.name}</span>
                                </li>
                            );
                        })}
                    </ol>
                    {onOpenPlan && (
                        <Button variant="primary" onClick={() => onOpenPlan(result.planId)}>
                            Open the itinerary
                        </Button>
                    )}
                </Card>
            )}

            {!area && !searching && (
                <EmptyState
                    icon={<GiCompass />}
                    message="Where are you going?"
                    hint='Try "Napa" or "Hayes Valley San Francisco". Everything you have saved nearby comes back, and you pick from it.'
                />
            )}
        </div>
    );
};

export default DayBuilder;
