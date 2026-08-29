import { Link } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';
import { HUES, blockPalette, blockStyle } from '../utils/blockColour';
import { describeCode } from '../utils/weather';
import { formatMoney, nightsOf } from '../utils/tripCosts';
import { legBands, legLabel, cityLabelOn, isTravelLeg } from '../utils/tripLegs';
import { HOURS, rowsFor, dragRange, timesFromDrag, movedTo, describeSpan } from '../utils/timeline';

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

const label = (hour) => {
    const h = hour % 24;
    const suffix = h < 12 ? 'am' : 'pm';
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return `${twelve}${suffix}`;
};

/* The hour rows begin on the fourth grid row: day heads, City, Lodging. */
const FIRST_HOUR_ROW = 4;

/* Where to look for a place mentioned on this day. A travel day has no
   coordinates worth biasing towards, so it falls back to nothing. */
const nearOn = (legs, day) => {
    const date = String(day?.date || '').slice(0, 10);
    const leg = (legs || []).find((l) => (
        !isTravelLeg(l)
        && String(l.start_date).slice(0, 10) <= date
        && String(l.end_date).slice(0, 10) >= date
    ));
    if (leg?.lat != null && leg?.lng != null) {
        return { city: leg.city, lat: leg.lat, lng: leg.lng, radiusKm: 30 };
    }
    const city = cityLabelOn(legs, day?.date) || day?.city;
    return city ? { city } : null;
};

const TripTimeline = ({
    days, items, stays, legs = [], costs, currency = 'USD', tripId = null,
    onCreate, onMove, onDropIdea, onOpen, onDelete, onRecolour,
}) => {
    /* The whole window, for a trip too wide for a column. Fifteen days at a
       readable width is wider than any page that also has a sidebar, and the
       answer to "where are the gaps" is one you want to see all of. */
    const [full, setFull] = useState(false);
    /* Which block has its swatches open. One at a time: two palettes on
       screen is two questions and no answer. */
    const [painting, setPainting] = useState(null);
    /* The block just dragged out, so it can be named without leaving the
       timeline. A block called "New plan" that can only be renamed in another
       view is a block you rename never. */
    /* What is in the rename box. Held here rather than left uncontrolled
       because picking from the mention menu has to write into it. */
    /* A drag in progress: which day, and the two rows it has touched. Held
       here rather than written per-cell so the highlight and the commit read
       the same selection. */
    const [drag, setDrag] = useState(null);
    const [over, setOver] = useState(null);

    /* The eight hues as this vibe has them. Re-read when the vibe changes,
       and not otherwise: it is a getComputedStyle call per hue. */
    const { themeId } = useTheme();
    const palette = useMemo(() => blockPalette(
        (name) => (typeof document === 'undefined'
            ? ''
            : getComputedStyle(document.documentElement).getPropertyValue(name))
    // themeId is not read inside, but it is exactly when the answer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [themeId]);

    const finish = useCallback(() => {
        setDrag((current) => {
            if (current && onCreate) {
                const { from, to } = dragRange(current.from, current.to);
                if (to > from) {
                    /* Dragging a block out is a statement about when it starts
                       and how long it runs, so what opens already knows both
                       and asks only for the rest. */
                    Promise.resolve(onCreate(current.dayId, timesFromDrag(current.from, current.to)))
                        .then((made) => made?.id && onOpen?.(current.dayId, made));
                }
            }
            return null;
        });
    }, [onCreate, onOpen]);

    /* The mouse leaves the grid mid-drag more often than it does not, so the
       release is listened for on the window rather than on a cell. */
    useEffect(() => {
        if (!drag) return undefined;
        window.addEventListener('mouseup', finish);
        return () => window.removeEventListener('mouseup', finish);
    }, [drag, finish]);

    /* Escape is what people press to get a full-screen thing off the screen,
       and it closes the swatches for the same reason. */
    useEffect(() => {
        if (!full && !painting) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (painting) setPainting(null);
            else setFull(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [full, painting]);

    if (!days.length) return null;

    const byId = Object.fromEntries((costs?.days || []).map((d) => [d.id, d]));
    const dates = days.map((d) => String(d.date).slice(0, 10));

    /* A leg and a stay span the same way, so they draw the same way. */
    const spanning = (covered) => {
        const inside = covered.filter((d) => dates.includes(d));
        if (!inside.length) return null;
        return { start: dates.indexOf(inside[0]), span: inside.length };
    };

    const cityBars = legBands(legs).map(({ leg, dates: band }) => {
        const box = spanning(band);
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
        <div className={`timeline-pane${full ? ' is-full' : ''}`}>
            <div className="timeline-pane__bar">
                <p className="timeline__hint">
                    Drag across the hours to block something out, drag a plan to move it,
                    or drag an idea in from below.
                </p>
                <button
                    type="button"
                    className="timeline-pane__expand"
                    aria-pressed={full}
                    onClick={() => setFull((v) => !v)}
                >
                    {full ? 'Close' : 'Expand'}
                </button>
            </div>

            <div className="timeline" role="table" aria-label="Trip timeline">
            <div
                className="timeline__grid"
                style={{ '--days': days.length }}
            >
                {/* Every cell is placed explicitly. Auto-placement refuses to
                    put an item where an explicitly-placed one already sits, so
                    the moment the block layer claimed the hour rows the whole
                    grid below it slid out of its columns. */}
                <div className="timeline__corner" style={{ gridRow: 1, gridColumn: 1 }} />

                {days.map((day, column) => {
                    const weather = day.weather;
                    const { icon } = weather ? describeCode(weather.code) : { icon: '' };
                    return (
                        <div
                            key={`h-${day.id}`}
                            className="timeline__dayhead"
                            style={{ gridRow: 1, gridColumn: column + 2 }}
                        >
                            {/* The date is the way in. This view is an
                                overview of what was built; the building
                                happens on the day's own page. */}
                            {tripId ? (
                                <Link
                                    className="timeline__open"
                                    to={`/atlas/${tripId}/day/${String(day.date).slice(0, 10)}`}
                                    title="Build this day"
                                >
                                    <strong>{format(parseISO(String(day.date).slice(0, 10)), 'EEE d')}</strong>
                                </Link>
                            ) : (
                                <strong>{format(parseISO(String(day.date).slice(0, 10)), 'EEE d')}</strong>
                            )}
                            {/* From the legs, not the day's own copy of them:
                                one place decides where you are. */}
                            <span className="timeline__city">
                                {cityLabelOn(legs, day.date) || day.city || '—'}
                            </span>
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
                <div className="timeline__rowlabel timeline__rowlabel--stays" style={{ gridRow: 2, gridColumn: 1 }}>City</div>
                <div className="timeline__stays" style={{ '--days': days.length, gridRow: 2 }}>
                    {cityBars.map(({ leg, start, span }) => (
                        <span
                            key={leg.id}
                            className="timeline__leg"
                            style={{ gridColumn: `${start + 1} / span ${span}` }}
                            title={`${legLabel(leg, legs)} — ${span} ${span === 1 ? 'day' : 'days'}`}
                        >
                            {legLabel(leg, legs)}
                        </span>
                    ))}
                    {!cityBars.length && <span className="timeline__nostay">No cities set</span>}
                </div>

                {/* Lodging, spanning. The merged cell from the sheet. */}
                <div className="timeline__rowlabel timeline__rowlabel--stays" style={{ gridRow: 3, gridColumn: 1 }}>Lodging</div>
                <div className="timeline__stays" style={{ '--days': days.length, gridRow: 3 }}>
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

                {/* The cells are the drag surface and nothing else; the things
                    planned are drawn over them, so a block can span hours
                    without the row it starts in having to contain it. */}
                {HOURS.map((hour, row) => (
                    <React.Fragment key={hour}>
                        <div
                            className="timeline__rowlabel"
                            style={{ gridRow: FIRST_HOUR_ROW + row, gridColumn: 1 }}
                        >
                            {label(hour)}
                        </div>
                        {days.map((day, column) => {
                            const selected = drag && drag.dayId === day.id
                                && hour >= Math.min(drag.from, drag.to)
                                && hour <= Math.max(drag.from, drag.to);
                            const hovered = over && over.dayId === day.id && over.hour === hour;
                            return (
                                <div
                                    key={`${day.id}-${hour}`}
                                    className={`timeline__cell${selected ? ' is-selecting' : ''}${hovered ? ' is-over' : ''}`}
                                    style={{ gridRow: FIRST_HOUR_ROW + row, gridColumn: column + 2 }}
                                    onMouseDown={(e) => {
                                        if (e.button !== 0 || !onCreate) return;
                                        e.preventDefault();
                                        setDrag({ dayId: day.id, from: hour, to: hour });
                                    }}
                                    onMouseEnter={() => {
                                        setDrag((d) => (d && d.dayId === day.id ? { ...d, to: hour } : d));
                                    }}
                                    onDragOver={(e) => {
                                        if (!onMove && !onDropIdea) return;
                                        e.preventDefault();
                                        setOver({ dayId: day.id, hour });
                                    }}
                                    onDragLeave={() => setOver(null)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setOver(null);
                                        const idea = e.dataTransfer.getData('application/x-idea');
                                        if (idea) {
                                            onDropIdea?.(day.id, timesFromDrag(hour, hour), JSON.parse(idea));
                                            return;
                                        }
                                        const moving = e.dataTransfer.getData('application/x-item');
                                        if (!moving) return;
                                        const { id, fromDay, item } = JSON.parse(moving);
                                        onMove?.(fromDay, day.id, id, movedTo(item, hour));
                                    }}
                                />
                            );
                        })}
                    </React.Fragment>
                ))}

                {/* Everything planned, drawn as blocks over the grid. */}
                <div
                    className="timeline__blocks"
                    style={{
                        '--days': days.length,
                        gridRow: `${FIRST_HOUR_ROW} / span ${HOURS.length}`,
                    }}
                >
                    {days.map((day, column) => (items[day.id] || []).map((item) => {
                        const box = rowsFor(item, HOURS);
                        if (!box) return null;
                        const open = painting === item.id;
                        return (
                            <span
                                key={item.id}
                                className={`timeline__item is-${item.kind}${open ? ' is-painting' : ''}`}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('application/x-item', JSON.stringify({
                                        id: item.id, fromDay: day.id, item,
                                    }));
                                }}
                                style={{
                                    gridColumn: column + 1,
                                    gridRow: `${box.start + 1} / span ${box.span}`,
                                    /* Its own colour if it has one; otherwise
                                       nothing at all, so the stylesheet's rule
                                       for its kind still applies. */
                                    ...(blockStyle(item, palette) || {}),
                                }}
                                title={`${item.title} · ${describeSpan(item)}`}
                                /* One click, because this is a thing you can
                                   see and want to change — not a thing you
                                   have to discover a gesture for. */
                                onClick={() => onOpen?.(day.id, item, nearOn(legs, day))}
                            >
                                    <>
                                        {item.title}
                                        <span className="timeline__tools">
                                            {item.link && (
                                                <a
                                                    className="timeline__open"
                                                    href={item.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title={item.location || 'Open the map'}
                                                    aria-label={`Open ${item.title} on the map`}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    ↗
                                                </a>
                                            )}
                                            {onRecolour && (
                                                <button
                                                    type="button"
                                                    className="timeline__paint"
                                                    aria-label={`Colour ${item.title}`}
                                                    aria-expanded={open}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPainting(open ? null : item.id);
                                                    }}
                                                >
                                                    ◑
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button
                                                    type="button"
                                                    className="timeline__drop"
                                                    aria-label={`Remove ${item.title}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(day.id, item.id);
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </span>
                                    </>

                                {open && (
                                    <span className="timeline__palette" role="group" aria-label="Colour">
                                        {HUES.map((n) => (
                                            <button
                                                key={n}
                                                type="button"
                                                className={`timeline__swatch${Number(item.colour) === n ? ' is-on' : ''}`}
                                                style={{ background: palette[n - 1]?.fill }}
                                                aria-label={`Colour ${n}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRecolour(day.id, item.id, n);
                                                    setPainting(null);
                                                }}
                                            />
                                        ))}
                                        {/* Back to the colour of its kind, which
                                            is a choice and not an absence. */}
                                        <button
                                            type="button"
                                            className="timeline__swatch timeline__swatch--none"
                                            aria-label="By kind"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRecolour(day.id, item.id, null);
                                                setPainting(null);
                                            }}
                                        >
                                            ×
                                        </button>
                                    </span>
                                )}
                            </span>
                        );
                    }))}
                </div>

                {/* Anything without a time still has to go somewhere, or it
                    would vanish from this view entirely. */}
                <div
                    className="timeline__rowlabel"
                    style={{ gridRow: FIRST_HOUR_ROW + HOURS.length, gridColumn: 1 }}
                >
                    Unscheduled
                </div>
                {days.map((day, column) => {
                    const loose = (items[day.id] || []).filter((i) => !i.start_time);
                    return (
                        <div
                            key={`${day.id}-loose`}
                            className="timeline__cell"
                            style={{ gridRow: FIRST_HOUR_ROW + HOURS.length, gridColumn: column + 2 }}
                        >
                            {loose.map((item) => (
                                <span
                                    key={item.id}
                                    className={`timeline__item is-${item.kind}`}
                                    style={blockStyle(item, palette) || undefined}
                                >
                                    {item.title}
                                </span>
                            ))}
                        </div>
                    );
                })}

                <div
                    className="timeline__rowlabel timeline__rowlabel--total"
                    style={{ gridRow: FIRST_HOUR_ROW + HOURS.length + 1, gridColumn: 1 }}
                >
                    Per person
                </div>
                {days.map((day, column) => (
                    <div
                        key={`${day.id}-cost`}
                        className="timeline__cost"
                        style={{ gridRow: FIRST_HOUR_ROW + HOURS.length + 1, gridColumn: column + 2 }}
                    >
                        {formatMoney(byId[day.id]?.total || 0, currency)}
                        <em>{formatMoney(byId[day.id]?.runningTotal || 0, currency)}</em>
                    </div>
                ))}
            </div>
            </div>
        </div>
    );
};

export default TripTimeline;
