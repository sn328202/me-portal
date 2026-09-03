import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { GiWorld, GiHouse, GiPositionMarker, GiEmptyHourglass } from 'react-icons/gi';
import { timeLabel } from '../utils/timeline';
import { cityLabelOn } from '../utils/tripLegs';
import '../styles/SharedTrip.css';

/**
 * Somebody else's trip, to somebody with the link and no account.
 *
 * Deliberately not the planner. The planner is a workshop — drag targets,
 * inline fields, a colour picker on every block — and none of that means
 * anything to a person who was sent a link. This is the same trip read as a
 * document: the days in order, what is on each one, and where you are
 * sleeping. It is also a great deal less surface to make safe.
 *
 * It renders outside the app shell: no rail, no capture bar, no theme picker.
 * A visitor has no account to hang any of that on.
 */

const day = (iso) => format(parseISO(String(iso).slice(0, 10)), 'EEEE d MMMM');

const Stop = ({ item }) => {
    const when = timeLabel(item);
    return (
        <li className={`shared__stop is-${item.kind}`}>
            <span className="shared__when">
                {when ? <time>{when.range}</time> : <em>anytime</em>}
                {when?.length && <span className="shared__long">{when.length}</span>}
            </span>
            <span className="shared__what">
                <strong>{item.title}</strong>
                {item.location && (
                    <span className="shared__where">
                        <GiPositionMarker aria-hidden="true" /> {item.location}
                    </span>
                )}
                {item.notes && <span className="shared__notes">{item.notes}</span>}
            </span>
        </li>
    );
};

const SharedTrip = () => {
    const { token } = useParams();
    const [state, setState] = useState({ loading: true });

    /* The app's <body> is a fixed-height frame — `height: 100dvh` with
       `overflow: hidden` — because the shell scrolls its own panes inside it.
       This page is not in the shell. It is a document, it is taller than the
       window, and inside that frame it was simply clipped: no scrollbar, no
       way down, the back half of the trip unreachable.
       
       Done in JavaScript rather than with `body:has(.shared-page)` because
       this is the one page in the app that gets opened by whoever was sent
       the link, on whatever browser they have. A visitor on a Firefox without
       `:has()` would get exactly the bug this is fixing. */
    useEffect(() => {
        document.body.classList.add('is-document');
        return () => document.body.classList.remove('is-document');
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`/api/share?token=${encodeURIComponent(token)}`);
                const body = await res.json();
                if (!alive) return;
                if (!res.ok) setState({ loading: false, error: body?.error || 'That link is not valid any more.' });
                else setState({ loading: false, data: body });
            } catch {
                if (alive) setState({ loading: false, error: 'Could not reach the trip.' });
            }
        })();
        return () => { alive = false; };
    }, [token]);

    if (state.loading) {
        return (
            <div className="shared-page"><div className="shared shared--message">
                <GiEmptyHourglass size={40} className="spin" aria-hidden="true" />
                <p>Fetching the trip…</p>
            </div></div>
        );
    }

    if (state.error) {
        return (
            <div className="shared-page"><div className="shared shared--message">
                <GiWorld size={40} aria-hidden="true" />
                <h1>Nothing here</h1>
                <p>{state.error}</p>
                <p className="shared__quiet">
                    Links can be turned off by the person who made them.
                </p>
            </div></div>
        );
    }

    const { trip, days, items, legs, stays } = state.data;
    const byDay = {};
    items.forEach((i) => { (byDay[i.day_id] = byDay[i.day_id] || []).push(i); });

    const span = trip.start_date && trip.end_date
        ? `${format(parseISO(trip.start_date), 'd MMM')} – ${format(parseISO(trip.end_date), 'd MMM yyyy')}`
        : null;

    return (
        <div className="shared-page"><div className="shared">
            <header className="shared__head">
                <p className="shared__eyebrow">A trip, shared with you</p>
                <h1>{trip.destination}</h1>
                {span && <p className="shared__dates">{span}</p>}
            </header>

            {stays.length > 0 && (
                <section className="shared__stays">
                    <h2>Where you are sleeping</h2>
                    <ul>
                        {stays.map((stay) => (
                            <li key={stay.id}>
                                <GiHouse aria-hidden="true" />
                                <span>
                                    <strong>{stay.name}</strong>
                                    {stay.address && <span className="shared__where">{stay.address}</span>}
                                </span>
                                <span className="shared__nights">
                                    {stay.check_in && format(parseISO(stay.check_in), 'd MMM')}
                                    {stay.check_out && ` – ${format(parseISO(stay.check_out), 'd MMM')}`}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="shared__days">
                {days.map((d) => {
                    const stops = (byDay[d.id] || []);
                    const city = cityLabelOn(legs, d.date) || d.city;
                    return (
                        <article key={d.id} className="shared__day">
                            <header>
                                <h2>{day(d.date)}</h2>
                                {city && <p className="shared__city">{city}</p>}
                            </header>
                            {stops.length ? (
                                <ul className="shared__stops">
                                    {stops.map((item) => <Stop key={item.id} item={item} />)}
                                </ul>
                            ) : (
                                <p className="shared__quiet">Nothing planned yet.</p>
                            )}
                        </article>
                    );
                })}
            </section>

            <footer className="shared__foot">
                <p>Made in the Me Portal</p>
            </footer>
        </div></div>
    );
};

export default SharedTrip;
