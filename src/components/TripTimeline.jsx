import React from 'react';
import { format, parseISO } from 'date-fns';
import { describeCode } from '../utils/weather';
import { formatMoney, nightsOf } from '../utils/tripCosts';
import { daysOfLeg } from '../utils/tripLegs';

/**
 * The spreadsheet's own grid: a column per day, an hour per row.
 *
 * The card view is better for filling a single day in — everything about that
 * day is in one place. This is better for seeing the shape of a trip: where the
 * gaps are, which afternoons are overloaded, and where you change cities. Those
 * are questions about the *relationships between* days, and a stack of cards
 * cannot answer them however good each card is.
 *
 * Lodging is drawn as a bar spanning its nights, which is exactly what the
 * merged cell in the Lodging row was doing.
 */

/** 6am to midnight, as the sheet had it. */
const HOURS = Array.from({ length: 19 }, (_, i) => i + 6);

const hourOf = (time) => {
    if (!time) return null;
    const h = Number(String(time).slice(0, 2));
    return Number.isFinite(h) ? h : null;
};

const label = (hour) => {
    const h = hour % 24;
    const suffix = h < 12 ? 'am' : 'pm';
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return `${twelve}${suffix}`;
};

const TripTimeline = ({ days, items, stays, legs = [], costs, currency = 'USD' }) => {
    if (!days.length) return null;

    const byId = Object.fromEntries((costs?.days || []).map((d) => [d.id, d]));
    const dates = days.map((d) => String(d.date).slice(0, 10));

    /* A leg and a stay span the same way, so they draw the same way. */
    const spanning = (covered) => {
        const inside = covered.filter((d) => dates.includes(d));
        if (!inside.length) return null;
        return { start: dates.indexOf(inside[0]), span: inside.length };
    };

    const cityBars = (legs || []).map((leg) => {
        const box = spanning(daysOfLeg(leg));
        return box && { leg, ...box };
    }).filter(Boolean);

    // Each stay becomes one bar: where it starts in this grid and how wide.
    const bars = (stays || []).map((stay) => {
        const nights = nightsOf(stay);
        const covered = nights.filter((n) => dates.includes(n));
        if (!covered.length) return null;
        const start = dates.indexOf(covered[0]);
        return { stay, start, span: covered.length };
    }).filter(Boolean);

    return (
        <div className="timeline" role="table" aria-label="Trip timeline">
            <div
                className="timeline__grid"
                style={{ '--days': days.length }}
            >
                {/* Corner */}
                <div className="timeline__corner" />

                {days.map((day) => {
                    const weather = day.weather;
                    const { icon } = weather ? describeCode(weather.code) : { icon: '' };
                    return (
                        <div key={`h-${day.id}`} className="timeline__dayhead">
                            <strong>{format(parseISO(String(day.date).slice(0, 10)), 'EEE d')}</strong>
                            <span className="timeline__city">{day.city || '—'}</span>
                            {weather && (
                                <span className="timeline__temp">
                                    {icon} {weather.high != null ? `${Math.round(weather.high)}°` : ''}
                                    {weather.source === 'normal' && <em title="a ten-year average, not a forecast">~</em>}
                                </span>
                            )}
                        </div>
                    );
                })}

                {/* City, spanning — the merged cell the sheet had at the top,
                    and the row that tells you where you are before it tells you
                    what you are doing. */}
                <div className="timeline__rowlabel timeline__rowlabel--stays">City</div>
                <div className="timeline__stays" style={{ '--days': days.length }}>
                    {cityBars.map(({ leg, start, span }) => (
                        <span
                            key={leg.id}
                            className="timeline__leg"
                            style={{ gridColumn: `${start + 1} / span ${span}` }}
                            title={`${leg.city} — ${span} ${span === 1 ? 'day' : 'days'}`}
                        >
                            {leg.city}
                        </span>
                    ))}
                    {!cityBars.length && <span className="timeline__nostay">No cities set</span>}
                </div>

                {/* Lodging, spanning. The merged cell from the sheet. */}
                <div className="timeline__rowlabel timeline__rowlabel--stays">Lodging</div>
                <div className="timeline__stays" style={{ '--days': days.length }}>
                    {bars.map(({ stay, start, span }) => (
                        <span
                            key={stay.id}
                            className="timeline__stay"
                            style={{ gridColumn: `${start + 1} / span ${span}` }}
                            title={`${stay.name} — ${span} ${span === 1 ? 'night' : 'nights'}`}
                        >
                            {stay.name}
                        </span>
                    ))}
                    {!bars.length && <span className="timeline__nostay">No lodging booked</span>}
                </div>

                {HOURS.map((hour) => (
                    <React.Fragment key={hour}>
                        <div className="timeline__rowlabel">{label(hour)}</div>
                        {days.map((day) => {
                            const slot = (items[day.id] || []).filter((i) => hourOf(i.start_time) === hour);
                            return (
                                <div key={`${day.id}-${hour}`} className="timeline__cell">
                                    {slot.map((item) => (
                                        <span
                                            key={item.id}
                                            className={`timeline__item is-${item.kind}`}
                                            title={item.title}
                                        >
                                            {item.title}
                                        </span>
                                    ))}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}

                {/* Anything without a time still has to go somewhere, or it
                    would vanish from this view entirely. */}
                <div className="timeline__rowlabel">Unscheduled</div>
                {days.map((day) => {
                    const loose = (items[day.id] || []).filter((i) => hourOf(i.start_time) === null);
                    return (
                        <div key={`${day.id}-loose`} className="timeline__cell">
                            {loose.map((item) => (
                                <span key={item.id} className={`timeline__item is-${item.kind}`}>
                                    {item.title}
                                </span>
                            ))}
                        </div>
                    );
                })}

                <div className="timeline__rowlabel timeline__rowlabel--total">Per person</div>
                {days.map((day) => (
                    <div key={`${day.id}-cost`} className="timeline__cost">
                        {formatMoney(byId[day.id]?.total || 0, currency)}
                        <em>{formatMoney(byId[day.id]?.runningTotal || 0, currency)}</em>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TripTimeline;
