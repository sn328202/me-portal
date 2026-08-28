import React from 'react';
import { format, parseISO } from 'date-fns';
import { GiKnot } from 'react-icons/gi';
import { Card } from './ui';
import { routeGaps } from '../utils/tripLegs';

/**
 * What is still unfinished about the trip: days with no city, nights with
 * nowhere booked, two cities claiming the same Tuesday.
 *
 * "Which nights have I not booked anywhere?" is answerable only by opening
 * every day card in turn, which means in practice it is not answered until
 * something goes wrong. That is why it is worth a panel.
 *
 * It lives at the *bottom* of the page rather than under the route list, where
 * it used to sit. Halfway up it read as the next step — a thing to go and fix
 * before carrying on — when it is really a checklist you glance at once the
 * planning is done. Nothing here is an error, and none of it blocks anything.
 *
 * Three failures named separately, because the fix for each is different.
 */

const TripLooseEnds = ({ tripDates, legs = [], stays = [] }) => {
    const gaps = routeGaps(tripDates, legs, stays);
    const pretty = (d) => format(parseISO(String(d).slice(0, 10)), 'd MMM');

    // Handovers are deliberately not counted: a day that starts in one city and
    // ends in another is a normal way to travel, not something to go and fix.
    const problems = gaps.unassigned.length + gaps.overlaps.length + gaps.unhoused.length;

    return (
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
    );
};

export default TripLooseEnds;
