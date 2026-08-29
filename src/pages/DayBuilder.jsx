import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { GiHourglass, GiFeather, GiPositionMarker, GiCoins, GiNotebook, GiCancel, GiTreasureMap } from 'react-icons/gi';
import { useJsApiLoader } from '@react-google-maps/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { Button, Card, ConfirmButton, EmptyState, Field, PageHeader } from '../components/ui';
import PlacesSearch from '../components/PlacesSearch';
import MentionInput from '../components/MentionInput';
import SmartTimeInput from '../components/SmartTimeInput';
import DurationPicker from '../components/DurationPicker';
import ActivityFace from '../components/ActivityFace';
import SortableItem from '../components/SortableItem';
import PlaceImage from '../components/PlaceImage';
import DayCard from '../components/DayCard';

import { useDayStops } from '../hooks/useDayStops';
import { useTravelTimes } from '../hooks/useTravelTimes';
import { timeBetween, asMinutes, asTime, lengthOf } from '../utils/dayOrder';
import { departAt, nextSlot } from '../utils/departAt';
import { longDate } from '../utils/dayCard';
import { generateGoogleCalendarUrl } from '../utils/calendarUtils';
import '../styles/DayPlanner.css';
import '../styles/DayBuilder.css';

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ['places'];

const BLANK = { activity: '', location: '', link: '', cost: '', place_id: null, lat: null, lng: null };

/**
 * A day of a trip, built rather than surveyed.
 *
 * This is the room the Daydream used to be, moved inside the Atlas and
 * pointed at the Atlas's own tables. It is a page and not a modal on purpose:
 * this is where ten minutes go at a stretch — dragging, reordering, checking
 * the board — and a drag-and-drop surface nested inside a scrolling dialog
 * inside a scrolling page is exactly what made the timeline freeze under her
 * hands last week. A page has a URL, a back button, and room to breathe.
 *
 * The Atlas pages around it stay an overview. This is the one editing
 * surface, so there is one place to learn and one place for a bug to be.
 */
const DayBuilder = () => {
    const { tripId, date } = useParams();
    const navigate = useNavigate();

    const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey, libraries });

    const {
        day, trip, timeline, ideas, loading, saving, savedAt, error, setError,
        addStop, updateStop, deleteStop, reorder,
        addIdea, updateIdea, deleteIdea, promote, demote,
    } = useDayStops({ tripId, date });

    const [draft, setDraft] = useState(BLANK);
    const [sharing, setSharing] = useState(false);
    /* True while a board card has a field focused, so the card does not start
       dragging out from under the cursor mid-selection. */
    const [editingIdea, setEditingIdea] = useState(false);
    const [near, setNear] = useState(null);
    const placesAnchor = useRef(null);
    const [placesService, setPlacesService] = useState(null);

    useEffect(() => {
        if (isLoaded && placesAnchor.current && !placesService) {
            setPlacesService(new window.google.maps.places.PlacesService(placesAnchor.current));
        }
    }, [isLoaded, placesService]);

    /* Where an @-mentioned place should be looked for: the day's own city,
       geocoded, so the search is biased towards it rather than having its
       name glued onto the query — which is how "@masque" once came back as a
       list of mosques. */
    const city = day?.city || trip?.destination || '';
    useEffect(() => {
        if (!isLoaded || !city) return undefined;
        let alive = true;
        new window.google.maps.Geocoder().geocode({ address: city }, (res, status) => {
            if (!alive) return;
            const at = status === 'OK' && res?.[0]?.geometry?.location;
            setNear(at
                ? { for: city, city, lat: at.lat(), lng: at.lng(), radiusKm: 30 }
                : { for: city, city });
        });
        return () => { alive = false; };
    }, [isLoaded, city]);

    const lookNear = near?.for === city ? near : (city ? { city } : null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const { times: travelTimes, legs: travelLegs } = useTravelTimes(timeline, isLoaded);
    const legFor = (id) => travelLegs.find((l) => l.id === id);

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = timeline.findIndex((i) => i.id === active.id);
        const newIndex = timeline.findIndex((i) => i.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;

        const moved = arrayMove(timeline, oldIndex, newIndex);
        // Put it where it was dropped. "Start when the previous one ends" is
        // routinely *after* the card it was dropped in front of, and the
        // re-sort then moves it back — so the card does not go where it was
        // dropped, which is the whole contract of dragging one.
        const at = moved.findIndex((i) => i.id === active.id);
        moved[at] = {
            ...moved[at],
            start_time: timeBetween(
                at > 0 ? moved[at - 1] : null,
                at < moved.length - 1 ? moved[at + 1] : null
            ),
        };
        reorder(moved);
    };

    /** Whatever is in the form, as a stop. */
    const draftStop = async () => {
        let placeData = null;
        if (draft.place_id && placesService) {
            try {
                const details = await new Promise((resolve) => {
                    placesService.getDetails({
                        placeId: draft.place_id,
                        fields: ['photos', 'rating', 'user_ratings_total', 'url', 'icon'],
                    }, (place, status) => resolve(
                        status === window.google.maps.places.PlacesServiceStatus.OK ? place : null
                    ));
                });
                if (details) {
                    placeData = {
                        rating: details.rating,
                        user_ratings_total: details.user_ratings_total,
                        icon: details.icon,
                        url: details.url,
                        photos: details.photos
                            ? details.photos.map((p) => ({
                                url: p.getUrl({ maxWidth: 200, maxHeight: 200 }),
                                attribution: p.html_attributions,
                            })).slice(0, 1)
                            : [],
                    };
                }
            } catch {
                // A place without its photo is still the place.
            }
        }
        return {
            activity: draft.activity,
            location: draft.location,
            link: draft.link,
            cost: draft.cost,
            place_id: draft.place_id,
            place_data: placeData,
        };
    };

    /* Two doors, and the default is the one she uses: most things typed here
       are things she is doing, not things she is considering. Straight onto
       the day goes at the end of it — every other position is one short drag
       from there. */
    const addToDay = async () => {
        if (!draft.activity) return;
        const stop = await draftStop();
        addStop({ ...stop, start_time: nextSlot(timeline) });
        setDraft(BLANK);
    };

    const addToBoard = async () => {
        if (!draft.activity) return;
        const stop = await draftStop();
        await addIdea(stop);
        setDraft(BLANK);
    };

    const card = useMemo(() => ({
        title: trip?.destination || 'A day',
        date,
        subtitle: day?.city || null,
        items: timeline,
        travel: travelTimes,
    }), [trip, date, day, timeline, travelTimes]);

    if (loading) {
        return <div className="daybuild"><p className="daybuild__waiting">Opening this day…</p></div>;
    }

    if (!day) {
        return (
            <div className="daybuild">
                <EmptyState
                    icon={<GiTreasureMap />}
                    message="There is no such day on this trip."
                    actionLabel="Back to the trip"
                    onAction={() => navigate(`/atlas?trip=${tripId}`)}
                />
            </div>
        );
    }

    return (
        <div className="daydream-page daydream-page--fixed daybuild">
            <PageHeader
                title={longDate(date) || date}
                icon={<GiHourglass />}
                subtitle={[trip?.destination, day.city].filter(Boolean).join(' · ') || null}
                actions={(
                    <>
                        <Button as={Link} to={`/atlas?trip=${tripId}`} variant="ghost">← The trip</Button>
                        <Button onClick={() => setSharing(true)}>📮 Share sheet</Button>
                        <span className="daybuild__state" role="status">
                            {saving ? 'Saving…' : savedAt ? 'Saved' : ''}
                        </span>
                    </>
                )}
            />

            {error && (
                <p className="daybuild__error" role="alert">
                    {error}
                    <button type="button" onClick={() => setError(null)} aria-label="Dismiss">×</button>
                </p>
            )}

            <div ref={placesAnchor} className="daydream__places-anchor" />

            <div className="daydream__boards">
                {/* The board */}
                <div className="board board--ideas">
                    <h3 className="board__title">
                        <GiFeather size={24} /> Ideas
                    </h3>

                    <Card variant="flat" className="idea-form">
                        <Field label="Activity">
                            <MentionInput
                                value={draft.activity}
                                near={lookNear}
                                placeholder="What is it? (@ to search a place)"
                                onChange={(activity) => setDraft((d) => ({ ...d, activity }))}
                                onPick={(place, activity) => setDraft((d) => ({
                                    ...d,
                                    activity,
                                    location: place.address || d.location,
                                    link: place.maps_url || d.link,
                                    place_id: place.place_id || d.place_id,
                                    lat: place.lat ?? d.lat,
                                    lng: place.lng ?? d.lng,
                                }))}
                            />
                        </Field>

                        {/* The Location box below is a search widget, not a
                            display of what is set — so a place pulled in by @
                            would land in the item with nothing on screen
                            saying so. This is that. */}
                        {(draft.location || draft.link) && (
                            <p className="idea-form__pulled">
                                <GiPositionMarker aria-hidden="true" />
                                <span>{draft.location || draft.link}</span>
                                {draft.link && <a href={draft.link} target="_blank" rel="noopener noreferrer">map</a>}
                                <button
                                    type="button"
                                    aria-label="Forget this place"
                                    onClick={() => setDraft((d) => ({ ...d, location: '', link: '', place_id: null, lat: null, lng: null }))}
                                >
                                    ×
                                </button>
                            </p>
                        )}

                        <div className="idea-form__row">
                            {isLoaded ? (
                                <Field label="Location">
                                    <PlacesSearch
                                        placeholder="Search Location…"
                                        onSelect={(place) => setDraft((d) => ({
                                            ...d,
                                            location: place.address,
                                            lat: place.lat,
                                            lng: place.lng,
                                            link: place.link,
                                            place_id: place.place_id,
                                        }))}
                                    />
                                </Field>
                            ) : (
                                <Field
                                    label="Location/Link"
                                    placeholder="Location/Link"
                                    value={draft.link}
                                    onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
                                />
                            )}
                            <Field
                                label="Cost ($)"
                                className="idea-form__cost"
                                placeholder="Cost ($)"
                                value={draft.cost}
                                onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
                            />
                        </div>

                        <div className="idea-form__actions">
                            <Button variant="primary" block onClick={addToDay}>Add to the day</Button>
                            <Button variant="ghost" block onClick={addToBoard}>Just an idea</Button>
                        </div>
                    </Card>

                    {ideas.length === 0 && (
                        <EmptyState icon={<GiFeather />} message="Nothing on the board yet." />
                    )}

                    <ul className="idea-grid">
                        {ideas.map((item) => (
                            <li
                                key={item.id}
                                className="idea"
                                draggable={!editingIdea}
                                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(item.id))}
                                onFocusCapture={(e) => { if (e.target.matches('input, textarea')) setEditingIdea(true); }}
                                onBlurCapture={() => setEditingIdea(false)}
                            >
                                <ActivityFace
                                    item={item}
                                    className="idea__face"
                                    onChange={(icon) => updateIdea(item.id, { icon })}
                                />

                                <input
                                    className="idea__title"
                                    key={`it-${item.id}`}
                                    aria-label={`Name of ${item.activity || 'this idea'}`}
                                    placeholder="What is it?"
                                    defaultValue={item.activity || ''}
                                    onBlur={(e) => {
                                        const v = e.target.value.trim();
                                        if (v !== (item.activity || '')) updateIdea(item.id, { activity: v });
                                    }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                />

                                <textarea
                                    className="idea__note"
                                    key={`in-${item.id}`}
                                    aria-label={`Notes on ${item.activity || 'this idea'}`}
                                    placeholder="Notes…"
                                    rows={1}
                                    defaultValue={item.notes || ''}
                                    onBlur={(e) => {
                                        const v = e.target.value.trim();
                                        if (v !== (item.notes || '')) updateIdea(item.id, { notes: v || null });
                                    }}
                                />

                                {item.location && (
                                    <p className="idea__line">
                                        <GiPositionMarker aria-hidden="true" /> {item.location}
                                    </p>
                                )}
                                {item.link && (
                                    <a className="idea__link" href={item.link} target="_blank" rel="noopener noreferrer">Map ↗</a>
                                )}

                                <div className="idea__fields">
                                    <span className="idea__field">
                                        <GiCoins aria-hidden="true" />
                                        <input
                                            key={`ic-${item.id}`}
                                            inputMode="decimal"
                                            aria-label={`Cost of ${item.activity || 'this'}`}
                                            placeholder="cost"
                                            defaultValue={item.cost ?? ''}
                                            onBlur={(e) => {
                                                const v = e.target.value.trim();
                                                if (v !== String(item.cost ?? '')) updateIdea(item.id, { cost: v });
                                            }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                        />
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="idea__schedule"
                                    onClick={() => promote(item.id, nextSlot(timeline))}
                                >
                                    Put it on the day →
                                </button>

                                <ConfirmButton
                                    className="idea__delete"
                                    icon="×"
                                    label={`Delete ${item.activity || 'idea'}`}
                                    confirmLabel="Confirm?"
                                    onConfirm={() => deleteIdea(item.id)}
                                />
                            </li>
                        ))}
                    </ul>
                </div>

                {/* The day */}
                <div
                    className="board board--timeline"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData('text/plain');
                        if (id) promote(id, nextSlot(timeline));
                    }}
                >
                    <h3 className="board__title board__title--crimson">
                        <GiHourglass size={24} /> The day
                    </h3>

                    <div className="timeline">
                        {timeline.length === 0 && (
                            <EmptyState icon={<GiHourglass />} message="Drag an idea here, or add something above." />
                        )}

                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={timeline.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                {timeline.map((item, index, arr) => (
                                    <React.Fragment key={item.id}>
                                        <SortableItem item={item}>
                                            {(handleProps) => (
                                                <div className="tl-row">
                                                    {index !== arr.length - 1 && <span className="tl-row__thread" />}

                                                    <Card variant="flat" className="tl-item">
                                                        <button
                                                            type="button"
                                                            className="tl-item__grip"
                                                            aria-label={`Reorder ${item.activity || 'this stop'}`}
                                                            {...handleProps}
                                                        >
                                                            <span className="tl-item__grip-dots" aria-hidden="true" />
                                                        </button>

                                                        <div className="tl-item__aside">
                                                            <SmartTimeInput
                                                                label={`Start time for ${item.activity || 'this stop'}`}
                                                                value={item.start_time ? item.start_time.substring(0, 5) : ''}
                                                                onChange={(v) => updateStop(item.id, { start_time: v ? `${v}:00` : null })}
                                                            />

                                                            <PlaceImage
                                                                photo={item.place_data?.photos?.[0]}
                                                                className="tl-item__photo"
                                                                fallback={(
                                                                    <ActivityFace
                                                                        item={item}
                                                                        onChange={(icon) => updateStop(item.id, { icon })}
                                                                    />
                                                                )}
                                                            />
                                                        </div>

                                                        <div className="tl-item__main">
                                                            <input
                                                                className="tl-item__title"
                                                                key={`t-${item.id}`}
                                                                aria-label={`Name of ${item.activity || 'this stop'}`}
                                                                placeholder="What is it?"
                                                                defaultValue={item.activity || ''}
                                                                onBlur={(e) => {
                                                                    const v = e.target.value.trim();
                                                                    if (v !== (item.activity || '')) updateStop(item.id, { activity: v });
                                                                }}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                            />

                                                            {item.location && (
                                                                <p className="tl-item__location">
                                                                    <GiPositionMarker aria-hidden="true" />
                                                                    {item.link ? (
                                                                        <a href={item.link} target="_blank" rel="noopener noreferrer">{item.location}</a>
                                                                    ) : item.location}
                                                                </p>
                                                            )}

                                                            <div className="tl-item__meta">
                                                                {item.place_data?.rating && (
                                                                    <span className="tl-item__rating">
                                                                        ★ {item.place_data.rating}
                                                                        {item.place_data.user_ratings_total ? <em>({item.place_data.user_ratings_total})</em> : null}
                                                                    </span>
                                                                )}

                                                                <span className="tl-item__cost">
                                                                    <GiCoins aria-hidden="true" />
                                                                    <input
                                                                        key={`c-${item.id}`}
                                                                        inputMode="decimal"
                                                                        aria-label={`Cost of ${item.activity || 'this'}`}
                                                                        placeholder="cost"
                                                                        defaultValue={item.cost ?? ''}
                                                                        onBlur={(e) => {
                                                                            const v = e.target.value.trim();
                                                                            if (v !== String(item.cost ?? '')) updateStop(item.id, { cost: v });
                                                                        }}
                                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        className={`tl-item__share${item.cost_shared === false ? '' : ' is-split'}`}
                                                                        title={item.cost_shared === false ? 'Each person pays this' : 'Split across the party'}
                                                                        onClick={() => updateStop(item.id, { cost_shared: item.cost_shared === false })}
                                                                    >
                                                                        {item.cost_shared === false ? 'each' : 'split'}
                                                                    </button>
                                                                </span>

                                                                <DurationPicker
                                                                    value={item.duration}
                                                                    label={item.activity}
                                                                    onChange={(duration) => updateStop(item.id, { duration })}
                                                                />
                                                            </div>

                                                            <textarea
                                                                className="tl-item__note"
                                                                key={`n-${item.id}`}
                                                                aria-label={`Notes on ${item.activity || 'this stop'}`}
                                                                placeholder="Notes…"
                                                                rows={1}
                                                                defaultValue={item.notes || ''}
                                                                onBlur={(e) => {
                                                                    const v = e.target.value.trim();
                                                                    if (v !== (item.notes || '')) updateStop(item.id, { notes: v || null });
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="tl-item__actions">
                                                            {item.start_time && (
                                                                <Button
                                                                    as="a"
                                                                    icon
                                                                    size="sm"
                                                                    href={generateGoogleCalendarUrl(item, date)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    label="Add to Google Calendar"
                                                                >
                                                                    📅
                                                                </Button>
                                                            )}
                                                            <Button
                                                                icon
                                                                size="sm"
                                                                label="Move back to the board"
                                                                onClick={() => demote(item.id)}
                                                            >
                                                                <GiNotebook size={16} />
                                                            </Button>
                                                            <ConfirmButton
                                                                icon={<GiCancel size={16} />}
                                                                label="Delete this stop"
                                                                confirmLabel="Confirm?"
                                                                onConfirm={() => deleteStop(item.id)}
                                                            />
                                                        </div>
                                                    </Card>
                                                </div>
                                            )}
                                        </SortableItem>

                                        {index !== arr.length - 1 && (
                                            <p className="tl-travel">
                                                <span className="tl-travel__tick" />
                                                {item.travel_note ? (
                                                    <>
                                                        <span>🚶 {item.travel_note}</span>
                                                        <button
                                                            type="button"
                                                            className="tl-travel__clear"
                                                            aria-label="Clear this travel time"
                                                            onClick={() => updateStop(item.id, { travel_note: null })}
                                                        >
                                                            ×
                                                        </button>
                                                    </>
                                                ) : travelTimes[item.id] ? (
                                                    <span>🚗 {travelTimes[item.id]} drive</span>
                                                ) : (
                                                    <input
                                                        className="tl-travel__input"
                                                        defaultValue=""
                                                        aria-label={`How long from ${item.activity || 'here'} to the next stop`}
                                                        placeholder={legFor(item.id)?.missing
                                                            ? 'No address either side — how long?'
                                                            : 'How long to the next one?'}
                                                        onBlur={(e) => {
                                                            const v = e.target.value.trim();
                                                            if (v) updateStop(item.id, { travel_note: v });
                                                        }}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                    />
                                                )}
                                                {(() => {
                                                    const leave = departAt(item, arr[index + 1], item.travel_note || travelTimes[item.id]);
                                                    if (!leave) return null;
                                                    if (!leave.late) {
                                                        return <span className="tl-travel__leave">leave by {leave.time.substring(0, 5)}</span>;
                                                    }
                                                    return (
                                                        <span
                                                            className="tl-travel__leave is-tight"
                                                            title={`${item.activity || 'This'} runs to ${asTime(asMinutes(item.start_time) + lengthOf(item)).substring(0, 5)}, but you need to leave at ${leave.time.substring(0, 5)}`}
                                                        >
                                                            ⚠️ {leave.late} min late — leave by {leave.time.substring(0, 5)}
                                                        </span>
                                                    );
                                                })()}
                                            </p>
                                        )}
                                    </React.Fragment>
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>
            </div>

            <DayCard
                open={sharing}
                onClose={() => setSharing(false)}
                title={card.title}
                date={card.date}
                subtitle={card.subtitle}
                items={card.items}
                travel={card.travel}
            />
        </div>
    );
};

export default DayBuilder;
