import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { GiTrashCan, GiHouse } from 'react-icons/gi';
import { Button, Card } from './ui';
import { nightsOf, perPerson, formatMoney } from '../utils/tripCosts';

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
                            <input
                                type="date"
                                value={String(stay.check_in).slice(0, 10)}
                                aria-label="Check in"
                                onChange={(e) => onUpdate(stay.id, { check_in: e.target.value })}
                            />
                            <input
                                type="date"
                                value={String(stay.check_out).slice(0, 10)}
                                aria-label="Check out"
                                onChange={(e) => onUpdate(stay.id, { check_out: e.target.value })}
                            />
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
                            <button
                                type="button"
                                className="stays__drop"
                                aria-label={`Remove ${stay.name}`}
                                onClick={() => onDelete(stay.id)}
                            >
                                <GiTrashCan />
                            </button>
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
