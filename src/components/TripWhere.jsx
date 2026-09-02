import React, { useState } from 'react';
import { GiTrashCan, GiPathDistance, GiHouse, GiCommercialAirplane, GiPositionMarker } from 'react-icons/gi';
import { Button, Card } from './ui';
import { formatMoney, nightsOf, perPerson } from '../utils/tripCosts';
import { summariseLegs, isTravelLeg, legDestination } from '../utils/tripLegs';
import { whereRows, unhousedNights, legFromStay, describeNewLeg } from '../utils/tripWhere';
import { cityFrom } from '../utils/placeCity';
import DateRange from './DateRange';
import PlaceField from './PlaceField';

/**
 * Where and when, as one card.
 *
 * These were two lists side by side — the cities, and the lodging — and she
 * saw the redundancy before I did: a booking already says which city you are
 * in and which nights it covers, so a row asserting the same city over the
 * same nights is the same fact typed twice.
 *
 * So a row here is a stretch: a city and the days it owns, with whatever is
 * booked for those nights sitting underneath it. The timeline keeps both of
 * its bars — City and Lodging are still two different questions once you are
 * looking at a calendar — it is only the place you *edit* them that stops
 * being two places.
 *
 * Two things follow from that and both are the point:
 *
 *   picking a hotel names the city, because Google already knows which city
 *   the hotel is in and making her type it again is asking her to do the
 *   computer's remembering;
 *
 *   booking somewhere she has not said she is going adds that city to the
 *   route, dates and all — "you have to stay somewhere", so a booking is a
 *   statement about where you will be. It says so before it does it.
 */

/**
 * One booking, under the stretch it covers.
 *
 * At module scope on purpose. Defined inside TripWhere it would be a new
 * component type on every render, so React would tear the whole row down and
 * build it again — which in a row made of text inputs means the field loses
 * focus after every single keystroke.
 */
const Bed = ({ stay, currency, partySize, onUpdate, onDelete, onPin }) => {
    const nights = nightsOf(stay);
    const each = nights.length
        ? perPerson(stay.cost, stay.cost_shared !== false, partySize) / nights.length / 100
        : 0;
    /* The booking link is a field on maybe one stay in three. Empty, it is an
       offer you can ignore rather than a line of placeholder text under every
       single booking. */
    const [linking, setLinking] = useState(false);

    return (
        <li className="bed">
            <div className="bed__top">
                <GiHouse className="bed__icon" aria-hidden="true" />
                <input
                    type="text"
                    className="bed__name"
                    value={stay.name}
                    aria-label="Where you are sleeping"
                    onChange={(e) => onUpdate(stay.id, { name: e.target.value })}
                />
                <DateRange
                    from={stay.check_in}
                    to={stay.check_out}
                    fromLabel="Check in"
                    toLabel="Check out"
                    empty="Which nights?"
                    onFrom={(v) => onUpdate(stay.id, { check_in: v })}
                    onTo={(v) => onUpdate(stay.id, { check_out: v })}
                />
                <span className="bed__nights">
                    {nights.length} {nights.length === 1 ? 'night' : 'nights'}
                </span>
                <input
                    type="number"
                    inputMode="decimal"
                    className="bed__cost"
                    placeholder="0"
                    value={stay.cost ?? ''}
                    aria-label="Total cost"
                    onChange={(e) => onUpdate(stay.id, { cost: e.target.value === '' ? 0 : e.target.value })}
                />
                <span className="bed__rate">{formatMoney(each, currency)} pp/night</span>
                <button
                    type="button"
                    className="bed__drop"
                    aria-label={`Remove ${stay.name}`}
                    onClick={() => onDelete(stay.id)}
                >
                    <GiTrashCan />
                </button>
            </div>

            <div className="bed__under">
                {/* A hotel has an address; an Airbnb has a link and no address
                    until the week before. Both offered, neither required. */}
                <PlaceField
                    className="bed__place"
                    location={stay.address}
                    link={stay.place_id
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stay.address || stay.name)}&query_place_id=${stay.place_id}`
                        : null}
                    label={stay.name || 'this stay'}
                    onPick={onPin}
                    onClear={stay.address
                        ? () => onUpdate(stay.id, { address: null, place_id: null })
                        : undefined}
                />

                {/* Which city, as a feature of the booking: Google told us
                    when the place was picked, so it is not a field. */}
                {stay.city && <span className="bed__city">{stay.city}</span>}

                {stay.link && (
                    <a className="bed__open" href={stay.link} target="_blank" rel="noopener noreferrer">
                        Open the booking ↗
                    </a>
                )}

                {(linking || stay.link) ? (
                    <input
                        type="url"
                        className="bed__link"
                        placeholder="Paste the Airbnb or hotel page…"
                        aria-label={`Link for ${stay.name || 'this stay'}`}
                        autoFocus={linking && !stay.link}
                        value={stay.link || ''}
                        onChange={(e) => onUpdate(stay.id, { link: e.target.value.trim() || null })}
                        onBlur={() => setLinking(false)}
                    />
                ) : (
                    <button type="button" className="bed__addlink" onClick={() => setLinking(true)}>
                        Add a booking link
                    </button>
                )}
            </div>
        </li>
    );
};

const TripWhere = ({
    legs, stays, days, items, costs, currency, partySize = 1, tripStart, tripEnd,
    onAddLeg, onUpdateLeg, onDeleteLeg,
    onAddStay, onUpdateStay, onDeleteStay,
}) => {
    const [addingLeg, setAddingLeg] = useState(false);
    const [legDraft, setLegDraft] = useState({ city: '', start_date: '', end_date: '' });
    /* Which row's "add somewhere to sleep" form is open, by leg id. One shared
       value meant opening it on one leg opened it on all of them. */
    const [addingBed, setAddingBed] = useState(null);
    const [bedDraft, setBedDraft] = useState({ name: '', check_in: '', check_out: '', cost: '' });

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
    const { rows, orphans } = whereRows(summary, stays);

    const submitLeg = (e) => {
        e.preventDefault();
        if (!legDraft.city.trim() || !legDraft.start_date || !legDraft.end_date) return;
        if (legDraft.end_date < legDraft.start_date) return;
        onAddLeg({ ...legDraft, city: legDraft.city.trim() });
        setLegDraft({ city: '', start_date: '', end_date: '' });
        setAddingLeg(false);
    };

    const openBed = (row) => {
        const open = unhousedNights(row);
        setAddingBed(row.leg.id);
        setBedDraft({
            name: '',
            /* Pre-filled with the nights this stretch still has open, because
               that is the booking she is about to describe. */
            check_in: open[0] || row.dates[0] || '',
            check_out: open.length
                ? row.dates[row.dates.indexOf(open[open.length - 1]) + 1] || row.dates[row.dates.length - 1]
                : row.dates[row.dates.length - 1] || '',
            cost: '',
        });
    };

    const submitBed = (e) => {
        e.preventDefault();
        if (!bedDraft.name.trim() || !bedDraft.check_in || !bedDraft.check_out) return;
        if (bedDraft.check_out <= bedDraft.check_in) return;
        onAddStay({
            name: bedDraft.name.trim(),
            check_in: bedDraft.check_in,
            check_out: bedDraft.check_out,
            cost: bedDraft.cost === '' ? 0 : Number(bedDraft.cost),
            cost_shared: true,
        });
        setBedDraft({ name: '', check_in: '', check_out: '', cost: '' });
        setAddingBed(null);
    };

    /**
     * A place picked for a booking.
     *
     * It carries the city, so the booking gets one, and the leg it lands in
     * gets one too if it did not have a real one — a stretch called "New leg"
     * with a hotel in San Francisco under it is a stretch in San Francisco.
     */
    const pinStay = (stay, row) => (place) => {
        const city = place.city || cityFrom(place);
        onUpdateStay(stay.id, {
            address: place.location,
            place_id: place.place_id,
            city: city || null,
        });
        if (city && row && !row.travel && !String(row.leg.city || '').trim()) {
            onUpdateLeg(row.leg.id, { city });
        }
    };

    /** An orphan booking, promoted to a stretch of the trip. */
    const adopt = (stay) => {
        const city = String(stay.city || '').trim();
        const leg = legFromStay(stay, city, legs);
        if (leg) onAddLeg(leg);
    };

    return (
        <Card className="where">
            <header className="where__head">
                <h4><GiPathDistance /> Where, and where you sleep</h4>
                <Button size="sm" variant="ghost" onClick={() => setAddingLeg((v) => !v)}>
                    {addingLeg ? 'Cancel' : '+ Add a city'}
                </Button>
            </header>

            {!rows.length && !addingLeg && (
                <p className="where__empty">
                    Nothing yet. Add a city — or book somewhere, and the city comes with it.
                </p>
            )}

            <ol className="where__list">
                {rows.map((row) => {
                    const open = unhousedNights(row);
                    return (
                        <li key={row.leg.id} className={`stretch${row.travel ? ' is-travel' : ''}`}>
                            {/* The city is the heading of its own section, so
                                it is drawn as one — a line of type rather than
                                a filled box the same size as everything under
                                it. It is still a field; it just does not shout
                                about it until you go near it. */}
                            <div className="stretch__top">
                                {row.travel
                                    ? <GiCommercialAirplane className="stretch__icon" aria-hidden="true" />
                                    : <GiPositionMarker className="stretch__icon" aria-hidden="true" />}
                                <input
                                    type="text"
                                    className="stretch__city"
                                    value={row.leg.city}
                                    placeholder="Where?"
                                    aria-label="City"
                                    onChange={(e) => onUpdateLeg(row.leg.id, { city: e.target.value })}
                                />
                                <DateRange
                                    from={row.leg.start_date}
                                    to={row.leg.end_date}
                                    fromLabel="Arrive"
                                    toLabel="Leave"
                                    empty="When?"
                                    onFrom={(v) => onUpdateLeg(row.leg.id, { start_date: v })}
                                    onTo={(v) => onUpdateLeg(row.leg.id, { end_date: v })}
                                />
                                <strong className="stretch__cost">{formatMoney(row.cost, currency)}</strong>
                                <button
                                    type="button"
                                    className="stretch__drop"
                                    aria-label={`Remove ${row.leg.city}`}
                                    onClick={() => onDeleteLeg(row.leg.id)}
                                >
                                    <GiTrashCan />
                                </button>
                            </div>

                            <p className="stretch__facts">
                                <span>{row.days} {row.days === 1 ? 'day' : 'days'} · {row.nights} {row.nights === 1 ? 'night' : 'nights'}</span>
                                {row.high != null && <span className="stretch__temp">avg {row.high}° / {row.low}°</span>}
                                <span>{row.planned} planned</span>
                                {isTravelLeg(row.leg) && (
                                    <em className="stretch__to">
                                        {legDestination(row.leg, legs) ? `heading to ${legDestination(row.leg, legs)}` : 'in the air'}
                                    </em>
                                )}

                                {/* Where this actually is. A stretch always had
                                    a coordinate, geocoded from whatever string
                                    was in the city box — fine until "Kerala"
                                    resolves to the middle of a state and the
                                    pin lands in a field. */}
                                <PlaceField
                                    className="stretch__place"
                                    location={row.leg.address}
                                    link={row.leg.place_id
                                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.leg.address || row.leg.city)}&query_place_id=${row.leg.place_id}`
                                        : null}
                                    label={row.leg.city || 'this leg'}
                                    onPick={(place) => onUpdateLeg(row.leg.id, {
                                        address: place.location,
                                        place_id: place.place_id,
                                        lat: place.lat ?? null,
                                        lng: place.lng ?? null,
                                    })}
                                    onClear={row.leg.address
                                        ? () => onUpdateLeg(row.leg.id, { address: null, place_id: null })
                                        : undefined}
                                />
                            </p>

                            {/* What is booked for these nights. A flight is not
                                asked — a red-eye is not a night she forgot. */}
                            {row.wantsBed && (
                                <div className="stretch__beds">
                                    <ul className="beds">
                                        {row.lodging.map((stay) => (
                                            <Bed
                                                key={stay.id}
                                                stay={stay}
                                                currency={currency}
                                                partySize={partySize}
                                                onUpdate={onUpdateStay}
                                                onDelete={onDeleteStay}
                                                onPin={pinStay(stay, row)}
                                            />
                                        ))}
                                    </ul>

                                    {addingBed === row.leg.id ? (
                                        <form className="beds__add" onSubmit={submitBed}>
                                            <input
                                                type="text" placeholder="Where…" autoFocus
                                                aria-label="Where you are sleeping"
                                                value={bedDraft.name}
                                                onChange={(e) => setBedDraft({ ...bedDraft, name: e.target.value })}
                                            />
                                            <input
                                                type="date" aria-label="Check in"
                                                min={tripStart || undefined} max={tripEnd || undefined}
                                                value={bedDraft.check_in}
                                                onChange={(e) => setBedDraft({ ...bedDraft, check_in: e.target.value })}
                                            />
                                            <input
                                                type="date" aria-label="Check out"
                                                min={bedDraft.check_in || tripStart || undefined}
                                                value={bedDraft.check_out}
                                                onChange={(e) => setBedDraft({ ...bedDraft, check_out: e.target.value })}
                                            />
                                            <input
                                                type="number" inputMode="decimal" placeholder="Total"
                                                aria-label="Total cost"
                                                value={bedDraft.cost}
                                                onChange={(e) => setBedDraft({ ...bedDraft, cost: e.target.value })}
                                            />
                                            <Button type="submit" variant="solid" size="sm">Add</Button>
                                            <Button
                                                type="button" size="sm" variant="ghost"
                                                onClick={() => setAddingBed(null)}
                                            >
                                                Cancel
                                            </Button>
                                            {bedDraft.check_in && bedDraft.check_out
                                                && bedDraft.check_out <= bedDraft.check_in && (
                                                <p className="beds__warn">Check-out needs to be after check-in.</p>
                                            )}
                                        </form>
                                    ) : (
                                        <button
                                            type="button"
                                            className={`beds__offer${open.length ? ' beds__offer--open' : ''}`}
                                            onClick={() => openBed(row)}
                                        >
                                            <GiHouse aria-hidden="true" />
                                            {open.length
                                                ? ` ${open.length} ${open.length === 1 ? 'night' : 'nights'} with nowhere booked`
                                                : ' Add another booking'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>

            {addingLeg && (
                <form className="where__add" onSubmit={submitLeg}>
                    <input
                        type="text" placeholder="City…" autoFocus aria-label="City"
                        value={legDraft.city}
                        onChange={(e) => setLegDraft({ ...legDraft, city: e.target.value })}
                    />
                    <input
                        type="date" aria-label="Arrive"
                        value={legDraft.start_date}
                        onChange={(e) => setLegDraft({ ...legDraft, start_date: e.target.value })}
                    />
                    <input
                        type="date" aria-label="Leave"
                        min={legDraft.start_date || undefined}
                        value={legDraft.end_date}
                        onChange={(e) => setLegDraft({ ...legDraft, end_date: e.target.value })}
                    />
                    <Button type="submit" variant="solid" size="sm">Add</Button>
                </form>
            )}

            {/* Booked somewhere she has not said she is going. It is the most
                interesting thing on the page, so it is not hidden — and the
                fix is one button, because the booking already knows the city
                and the dates. */}
            {orphans.length > 0 && (
                <div className="where__orphans">
                    <h5>Booked, but not on the route yet</h5>
                    <ul>
                        {orphans.map((stay) => {
                            const leg = legFromStay(stay, String(stay.city || '').trim(), legs);
                            return (
                                <li key={stay.id}>
                                    <span className="where__orphan-name">
                                        {stay.name}
                                        <em>{String(stay.check_in).slice(0, 10)} → {String(stay.check_out).slice(0, 10)}</em>
                                    </span>
                                    {leg ? (
                                        <Button size="sm" variant="ghost" onClick={() => adopt(stay)} title={describeNewLeg(leg)}>
                                            Add {leg.city} to the route
                                        </Button>
                                    ) : (
                                        <span className="where__orphan-note">
                                            Pin it to a place and it can name its own city.
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </Card>
    );
};

export default TripWhere;
