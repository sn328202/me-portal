import React, { useState } from 'react';
import { GiTrashCan, GiHouse } from 'react-icons/gi';
import { Button, Card } from './ui';
import { nightsOf, perPerson, formatMoney } from '../utils/tripCosts';
import DateField from './DateField';
import PlaceField from './PlaceField';

/**
 * Lodging, entered once for the nights it covers.
 *
 * In the spreadsheet the Lodging row was a merged cell running across however
 * many day columns a booking covered — which is the right shape, and one a
 * per-day text field cannot express. Modelling it per day meant typing the
 * hotel's name into four cells and dividing its cost by four in your head
 * before typing that too.
 *
 * The cost is entered as the whole booking, because that is what the
 * confirmation email says. What each person owes per night falls out of it.
 *
 * A stay has a place and a link now. Half of lodging is a hotel with an
 * address, and the other half is an Airbnb whose address you do not get until
 * the week before — so both are offered and neither is required. `address` and
 * `link` had been columns on the table since it was made, holding nothing,
 * because there was nowhere on screen to put them.
 */

const TripStays = ({ stays, currency, partySize, tripStart, tripEnd, onAdd, onUpdate, onDelete }) => {
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState({ name: '', check_in: '', check_out: '', cost: '' });

    const submit = (e) => {
        e.preventDefault();
        if (!draft.name.trim() || !draft.check_in || !draft.check_out) return;
        if (draft.check_out <= draft.check_in) return;
        onAdd({
            name: draft.name.trim(),
            check_in: draft.check_in,
            check_out: draft.check_out,
            cost: draft.cost === '' ? 0 : Number(draft.cost),
            cost_shared: true,
        });
        setDraft({ name: '', check_in: '', check_out: '', cost: '' });
        setAdding(false);
    };

    return (
        <Card className="stays">
            <header className="stays__head">
                <h4><GiHouse /> Lodging</h4>
                <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
                    {adding ? 'Cancel' : '+ Add a stay'}
                </Button>
            </header>

            {stays.length === 0 && !adding && (
                <p className="stays__empty">Nowhere booked yet.</p>
            )}

            <ul className="stays__list">
                {stays.map((stay) => {
                    const nights = nightsOf(stay);
                    const each = nights.length
                        ? perPerson(stay.cost, stay.cost_shared !== false, partySize) / nights.length / 100
                        : 0;
                    return (
                        <li key={stay.id} className="stays__row">
                            <input
                                type="text"
                                className="stays__name"
                                value={stay.name}
                                aria-label="Where"
                                onChange={(e) => onUpdate(stay.id, { name: e.target.value })}
                            />
                            <DateField
                                value={stay.check_in}
                                aria-label="Check in"
                                onCommit={(v) => onUpdate(stay.id, { check_in: v || null })}
                            />
                            <DateField
                                value={stay.check_out}
                                aria-label="Check out"
                                onCommit={(v) => onUpdate(stay.id, { check_out: v || null })}
                            />
                            <button
                                type="button"
                                className="stays__drop"
                                aria-label={`Remove ${stay.name}`}
                                onClick={() => onDelete(stay.id)}
                            >
                                <GiTrashCan />
                            </button>

                            <input
                                type="number"
                                inputMode="decimal"
                                className="stays__cost"
                                value={stay.cost ?? ''}
                                aria-label="Total cost"
                                onChange={(e) => onUpdate(stay.id, { cost: e.target.value === '' ? 0 : e.target.value })}
                            />
                            {/* The whole point: the booking total, and what that
                                actually means per person per night. */}
                            <span className="stays__each">
                                {nights.length} {nights.length === 1 ? 'night' : 'nights'}
                                <em>{formatMoney(each, currency)} pp / night</em>
                            </span>

                            {/* A hotel has an address; an Airbnb has a link
                                and no address until the week before. Both are
                                offered, neither is required. */}
                            <PlaceField
                                className="stays__place"
                                location={stay.address}
                                link={stay.place_id
                                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stay.address || stay.name)}&query_place_id=${stay.place_id}`
                                    : null}
                                label={stay.name || 'this stay'}
                                onPick={(place) => onUpdate(stay.id, {
                                    address: place.location,
                                    place_id: place.place_id,
                                })}
                                onClear={stay.address
                                    ? () => onUpdate(stay.id, { address: null, place_id: null })
                                    : undefined}
                            />

                            <input
                                type="url"
                                className="stays__link"
                                placeholder="Booking link (Airbnb, hotel…)"
                                aria-label={`Link for ${stay.name || 'this stay'}`}
                                value={stay.link || ''}
                                onChange={(e) => onUpdate(stay.id, { link: e.target.value.trim() || null })}
                            />
                            {stay.link && (
                                <a
                                    className="stays__open"
                                    href={stay.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Open the booking ↗
                                </a>
                            )}
                        </li>
                    );
                })}
            </ul>

            {adding && (
                <form className="stays__add" onSubmit={submit}>
                    <input
                        type="text"
                        placeholder="Where…"
                        autoFocus
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                    <input
                        type="date"
                        aria-label="Check in"
                        min={tripStart || undefined}
                        max={tripEnd || undefined}
                        value={draft.check_in}
                        onChange={(e) => setDraft({ ...draft, check_in: e.target.value })}
                    />
                    <input
                        type="date"
                        aria-label="Check out"
                        min={draft.check_in || tripStart || undefined}
                        value={draft.check_out}
                        onChange={(e) => setDraft({ ...draft, check_out: e.target.value })}
                    />
                    <input
                        type="number"
                        inputMode="decimal"
                        placeholder="Total"
                        value={draft.cost}
                        onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
                    />
                    <Button type="submit" variant="solid" size="sm">Add</Button>
                    {/* Checkout is the morning after the last night, so a same-day
                        pair is zero nights and would silently cost nothing. */}
                    {draft.check_in && draft.check_out && draft.check_out <= draft.check_in && (
                        <p className="stays__warn">Check-out needs to be after check-in.</p>
                    )}
                </form>
            )}
        </Card>
    );
};

export default TripStays;
