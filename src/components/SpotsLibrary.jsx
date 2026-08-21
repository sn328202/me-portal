import React, { useState, useMemo } from 'react';
import {
    GiPositionMarker, GiForkKnifeSpoon, GiWineGlass, GiCoffeeCup, GiGreekTemple,
    GiTreeBranch, GiMountainRoad, GiShoppingBag, GiTheater, GiLotus, GiHouse,
    GiCheckMark, GiTrashCan, GiMagnifyingGlass,
} from 'react-icons/gi';
import { Button, Card, Field, Tag, EmptyState, ConfirmButton } from './ui';
import { useSpots } from '../hooks/useSpots';
import '../styles/Spots.css';

const CATEGORY_ICON = {
    restaurant: <GiForkKnifeSpoon />,
    bar: <GiWineGlass />,
    cafe: <GiCoffeeCup />,
    museum: <GiGreekTemple />,
    park: <GiTreeBranch />,
    hike: <GiMountainRoad />,
    shop: <GiShoppingBag />,
    venue: <GiTheater />,
    wellness: <GiLotus />,
    lodging: <GiHouse />,
};

const CATEGORIES = [
    'restaurant', 'bar', 'cafe', 'museum', 'park',
    'hike', 'shop', 'venue', 'wellness', 'lodging', 'other',
];

const EMPTY_FORM = { name: '', city: '', why: '' };

/** Google's 0-4 scale as the thing people recognise. */
const priceTag = (level) =>
    typeof level === 'number' && level > 0 ? '$'.repeat(Math.min(level, 4)) : null;

/**
 * The saved-places library. Places she wants to go, independent of any
 * particular day — itineraries pull from here rather than owning a copy.
 */
const SpotsLibrary = ({ plans = [], onAddToPlan }) => {
    const { spots, loading, error, addSpot, toggleVisited, deleteSpot } = useSpots();

    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('want to go');
    const [category, setCategory] = useState('all');

    const counts = useMemo(() => ({
        'want to go': spots.filter((s) => s.status !== 'been').length,
        been: spots.filter((s) => s.status === 'been').length,
    }), [spots]);

    const categoriesPresent = useMemo(
        () => CATEGORIES.filter((c) => spots.some((s) => (s.category || 'other') === c)),
        [spots]
    );

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return spots.filter((s) => {
            if (status === 'want to go' && s.status === 'been') return false;
            if (status === 'been' && s.status !== 'been') return false;
            if (category !== 'all' && (s.category || 'other') !== category) return false;
            if (!q) return true;
            return [s.name, s.why, s.neighborhood, s.city, s.address, (s.tags || []).join(' ')]
                .filter(Boolean).join(' ').toLowerCase().includes(q);
        });
    }, [spots, query, status, category]);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || saving) return;
        setSaving(true);
        try {
            await addSpot({ name: form.name.trim(), city: form.city.trim(), why: form.why.trim() });
            setForm(EMPTY_FORM);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="spots">
            <form className="spots__add" onSubmit={submit}>
                <Field
                    label="Somewhere you want to go"
                    placeholder="Tartine Bakery"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Field
                    label="City"
                    placeholder="San Francisco"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
                <Field
                    label="Why"
                    placeholder="Ali said the morning buns"
                    value={form.why}
                    onChange={(e) => setForm({ ...form, why: e.target.value })}
                />
                <Button type="submit" variant="solid" disabled={!form.name.trim() || saving}>
                    {saving ? 'Looking it up…' : 'Save spot'}
                </Button>
            </form>

            <div className="spots__filters">
                <div className="spots__search">
                    <GiMagnifyingGlass aria-hidden="true" />
                    <input
                        className="input"
                        type="search"
                        placeholder="Search your spots"
                        aria-label="Search your spots"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                <div className="spots__chips" role="group" aria-label="Status">
                    {[
                        { id: 'want to go', label: `Want to go (${counts['want to go']})` },
                        { id: 'been', label: `Been (${counts.been})` },
                        { id: 'all', label: 'All' },
                    ].map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className={`chip${status === option.id ? ' chip--on' : ''}`}
                            aria-pressed={status === option.id}
                            onClick={() => setStatus(option.id)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {categoriesPresent.length > 1 && (
                    <div className="spots__chips" role="group" aria-label="Category">
                        <button
                            type="button"
                            className={`chip${category === 'all' ? ' chip--on' : ''}`}
                            aria-pressed={category === 'all'}
                            onClick={() => setCategory('all')}
                        >
                            Everything
                        </button>
                        {categoriesPresent.map((c) => (
                            <button
                                key={c}
                                type="button"
                                className={`chip${category === c ? ' chip--on' : ''}`}
                                aria-pressed={category === c}
                                onClick={() => setCategory(c)}
                            >
                                {CATEGORY_ICON[c] || <GiPositionMarker />} {c}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {error && <p className="spots__error">{error}</p>}

            {loading ? (
                <p className="muted">Reading your spots…</p>
            ) : visible.length === 0 ? (
                <EmptyState
                    icon={<GiPositionMarker />}
                    message={spots.length ? 'Nothing matches that.' : 'No spots saved yet.'}
                    hint={spots.length
                        ? 'Try a different filter.'
                        : 'Say "I want to try that ramen place in Hayes Valley" into the portal shortcut, or add one above.'}
                />
            ) : (
                <ul className="spots__grid">
                    {visible.map((spot) => (
                        <li key={spot.id}>
                            <Card
                                variant="flat"
                                className={`spot${spot.status === 'been' ? ' spot--been' : ''}`}
                            >
                                {spot.image_url && (
                                    <div className="spot__image">
                                        <img src={spot.image_url} alt="" loading="lazy" />
                                    </div>
                                )}

                                <div className="spot__body">
                                    <h3 className="spot__name">
                                        {spot.maps_url ? (
                                            <a href={spot.maps_url} target="_blank" rel="noopener noreferrer">
                                                {spot.name}
                                            </a>
                                        ) : spot.name}
                                    </h3>

                                    <p className="spot__where">
                                        <span className="spot__icon" aria-hidden="true">
                                            {CATEGORY_ICON[spot.category] || <GiPositionMarker />}
                                        </span>
                                        {[spot.neighborhood, spot.city].filter(Boolean).join(', ') || 'Location unknown'}
                                    </p>

                                    {(spot.rating || priceTag(spot.price_level)) && (
                                        <p className="spot__stats">
                                            {spot.rating && <span>★ {Number(spot.rating).toFixed(1)}</span>}
                                            {priceTag(spot.price_level) && <span>{priceTag(spot.price_level)}</span>}
                                        </p>
                                    )}

                                    {spot.why && <p className="spot__why">“{spot.why}”</p>}

                                    {(spot.tags || []).length > 0 && (
                                        <div className="spot__tags">
                                            {spot.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                                        </div>
                                    )}
                                </div>

                                <div className="spot__actions">
                                    <Button
                                        size="sm"
                                        onClick={() => toggleVisited(spot)}
                                        aria-pressed={spot.status === 'been'}
                                    >
                                        <GiCheckMark /> {spot.status === 'been' ? 'Been' : 'Mark been'}
                                    </Button>

                                    {plans.length > 0 && onAddToPlan && (
                                        <select
                                            className="select select--sm"
                                            aria-label={`Add ${spot.name} to an itinerary`}
                                            value=""
                                            onChange={(e) => {
                                                if (e.target.value) onAddToPlan(spot, e.target.value);
                                                e.target.value = '';
                                            }}
                                        >
                                            <option value="">Add to a day…</option>
                                            {plans.map((p) => (
                                                <option key={p.id} value={p.id}>{p.title}</option>
                                            ))}
                                        </select>
                                    )}

                                    <ConfirmButton
                                        size="sm"
                                        icon
                                        label={`Delete ${spot.name}`}
                                        onConfirm={() => deleteSpot(spot.id)}
                                    >
                                        <GiTrashCan />
                                    </ConfirmButton>
                                </div>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SpotsLibrary;
