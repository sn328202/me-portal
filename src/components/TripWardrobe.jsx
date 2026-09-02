import React from 'react';
import { GiClothes } from 'react-icons/gi';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Button } from './ui';
import { useWardrobeLink } from '../hooks/useWardrobeLink';
import { wardrobeIdFor } from '../utils/wardrobeLink';

/**
 * What the Wardrobe knows about this trip, and one way in.
 *
 * The handoff existed before this and was a button in the setup drawer: press
 * it and the trip is copied across, once. Two things were wrong with that.
 * The copy went stale the moment a day moved, silently, because a stale trip
 * looks exactly like a fresh one. And there was nothing anywhere saying the
 * link existed at all — no count, no date, no way back — so the honest
 * description of the feature was "a button she has never found".
 *
 * So: it keeps itself current (`useWardrobeLink`), and this says so. Days
 * planned and days with weather are what the Atlas sent; dressed and packed
 * are what she has done in there, per person, because two people packing for
 * one fortnight is two jobs and a combined number describes neither.
 *
 * A trip the Wardrobe has never seen gets an offer rather than a status. It is
 * deliberately opt-in per trip: pushing every trip across automatically would
 * fill the packing planner with the eleven she is only reminiscing about.
 */
const TripWardrobe = ({ trip, data }) => {
    const { state, error, sentAt, push } = useWardrobeLink(trip, data);

    if (!trip) return null;

    const send = () => push();
    const open = `/wardrobe?trip=${encodeURIComponent(wardrobeIdFor(trip.id))}`;

    return (
        <div className="field trip-wardrobe">
            <span className="field__label">THE WARDROBE</span>

            {!state.present ? (
                <>
                    <p className="trip-wardrobe__none">
                        Not packing for this one yet. Send it across and the days, the
                        weather and how dressed-up each one is go with it — and stay
                        current as you change the plan.
                    </p>
                    <Button size="sm" variant="ghost" onClick={send}>
                        <GiClothes /> Pack for this trip
                    </Button>
                </>
            ) : (
                <>
                    <p className="trip-wardrobe__sum">
                        <strong>{state.events}</strong> {state.events === 1 ? 'day' : 'days'} sent
                        {state.weatherDays > 0 && <>, weather on {state.weatherDays}</>}.
                        {' '}Kept current as the plan changes.
                    </p>

                    {state.people.length > 0 ? (
                        <ul className="trip-wardrobe__people">
                            {state.people.map((p) => (
                                <li key={p.id}>
                                    <strong>{p.name}</strong>
                                    <span>
                                        {p.dressed} {p.dressed === 1 ? 'day' : 'days'} dressed
                                        {p.packed > 0 && <> · {p.packed} packed</>}
                                        {p.outfits > 0 && <> · {p.outfits} {p.outfits === 1 ? 'outfit' : 'outfits'} made</>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="trip-wardrobe__none">
                            Nothing chosen to wear yet.
                        </p>
                    )}

                    <div className="trip-wardrobe__row">
                        <a className="atlas-link" href={open}>Open in the Wardrobe</a>
                        {/* The link keeps up on its own; this is for the day it
                            does not, which is a promise no code should make
                            without also leaving a way to check. */}
                        <Button size="sm" variant="ghost" onClick={send}>Send it again</Button>
                    </div>
                </>
            )}

            {sentAt && !error && (
                <p className="trip-wardrobe__when">
                    Last change sent {formatDistanceToNow(parseISO(sentAt), { addSuffix: true })}.
                </p>
            )}

            {error && (
                <p className="trip-wardrobe__bad" role="status">
                    {error} The Wardrobe keeps its things in this browser, so this is
                    about this browser rather than your account.
                </p>
            )}
        </div>
    );
};

export default TripWardrobe;
