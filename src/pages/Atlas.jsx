import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GiWorld, GiCompass, GiPin } from 'react-icons/gi';
import InteractiveMap from '../components/InteractiveMap';
import { Button, Card, ConfirmButton, Field, PageHeader, Tag } from '../components/ui';
import { useAtlas } from '../hooks/useAtlas';
import { supabase } from '../lib/supabase';
import TripPlanner from '../components/TripPlanner';
import TripSheet from '../components/TripSheet';
import TripIdeas from '../components/TripIdeas';
import TripLooseEnds from '../components/TripLooseEnds';
import DateField from '../components/DateField';
import { useTripDays } from '../hooks/useTripDays';
import { useTripIdeas } from '../hooks/useTripIdeas';
import { flagsForLegs } from '../utils/flags';
import { legDestination, isTravelLeg } from '../utils/tripLegs';
import '../styles/Atlas.css';

const STATUS_TONE = {
    Dreaming: 'gold',
    Planned: 'default',
    Completed: 'green'
};

const Atlas = () => {
    const { trips, waypoints, addTrip, updateTrip, deleteTrip, addWaypoint, updateWaypoint, deleteWaypoint } = useAtlas();

    // The Atlas is an index (The Map Room) and a detail view (the Expedition
    // Log). That is navigation, not tabs — the view follows the selection.
    const [selectedTripId, setSelectedTripId] = useState(null);

    const selectedTrip = trips.find(t => t.id === selectedTripId);
    const currentWaypoints = selectedTripId ? (waypoints[selectedTripId] || []) : [];

    // The trip's days live here rather than inside the planner, because three
    // separate things need them now: the day planner, the spreadsheet export,
    // and the handoff to the Wardrobe. Fetching them three times would be
    // three answers to one question.
    const planner = useTripDays(selectedTrip);

    // Lifted for the same reason as the days: the board shows the ideas and
    // the timeline needs to mark one used when it is dragged onto an hour.
    const ideas = useTripIdeas(selectedTrip?.id);

    const { legs } = planner;
    const [locating, setLocating] = useState(false);
    const [legsByTrip, setLegsByTrip] = useState({});

    /* Every trip's legs, for the flags on the index cards. One query, not one
       per card — and only the two columns the flags actually need. */
    useEffect(() => {
        let alive = true;
        (async () => {
            const ids = trips.map((t) => t.id);
            if (!ids.length) { setLegsByTrip({}); return; }
            const { data } = await supabase
                .from('atlas_legs').select('trip_id, city, country, country_code')
                .in('trip_id', ids);
            if (!alive) return;
            const grouped = {};
            for (const row of data || []) (grouped[row.trip_id] ||= []).push(row);
            setLegsByTrip(grouped);
        })();
        return () => { alive = false; };
    }, [trips]);

    const tripFlags = useMemo(() => Object.fromEntries(
        Object.entries(legsByTrip).map(([id, rows]) => [id, flagsForLegs(rows)])
    ), [legsByTrip]);

    /* A leg on the map is the city it puts you in, so a travel leg shows its
       destination rather than a pin in the sea labelled "Air Travel". */
    const routeStops = useMemo(() => (legs || [])
        .filter((leg) => leg.lat != null && leg.lng != null)
        .map((leg, i) => ({
            key: leg.id,
            lat: leg.lat,
            lng: leg.lng,
            label: isTravelLeg(leg) ? legDestination(leg, legs) : leg.city,
            sub: `${String(leg.start_date).slice(0, 10)} → ${String(leg.end_date).slice(0, 10)}`,
            // Numbered, because the order is half of what the map is saying.
            badge: String(i + 1),
            leg: true,
        })), [legs]);

    /**
     * Look up any leg that does not yet know where it is.
     *
     * Automatic rather than a button: a city she has typed is a city she wants
     * on the map, and asking her to press "locate" afterwards is asking her to
     * do the computer's remembering.
     */
    const locate = useCallback(async () => {
        if (!selectedTrip?.id) return;
        const unlocated = (legs || []).filter((l) => l.city && !isTravelLeg(l) && l.lat == null);
        if (!unlocated.length) return;

        setLocating(true);
        try {
            const { data: session } = await supabase.auth.getSession();
            const res = await fetch('/api/atlas-locate', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${session?.session?.access_token}`,
                },
                body: JSON.stringify({ tripId: selectedTrip.id }),
            });
            if (res.ok) await planner.reload();
        } catch (err) {
            console.error('Could not locate the legs:', err);
        } finally {
            setLocating(false);
        }
    }, [selectedTrip?.id, legs, planner]);

    useEffect(() => { locate(); }, [locate]);

    // Handlers
    const handleAddTrip = async () => {
        const newTrip = {
            destination: 'New Expedition',
            status: 'Dreaming',
            coordinates: null
        };
        const created = await addTrip(newTrip);
        if (created) {
            setSelectedTripId(created.id);
        }
    };

    const handleUpdateTrip = (id, updates) => {
        updateTrip(id, updates);
    };

    const handleAddLink = () => {
        if (!selectedTrip) return;
        const newLink = { title: 'New Resource', url: '' };
        const newLinks = [...(selectedTrip.links || []), newLink];
        handleUpdateTrip(selectedTrip.id, { links: newLinks });
    };

    const handleUpdateLink = (index, field, value) => {
        if (!selectedTrip) return;
        const updatedLinks = [...(selectedTrip.links || [])];
        updatedLinks[index] = { ...updatedLinks[index], [field]: value };
        handleUpdateTrip(selectedTrip.id, { links: updatedLinks });
    };

    const handleDeleteLink = (index) => {
        if (!selectedTrip) return;
        const updatedLinks = [...(selectedTrip.links || [])].filter((_, i) => i !== index);
        handleUpdateTrip(selectedTrip.id, { links: updatedLinks });
    };

    // Helper for adding waypoint
    const handleAddWaypoint = (name, lat, lng) => {
        if (!selectedTrip) return;
        addWaypoint(selectedTrip.id, { name, lat, lng });
    };

    const [loadingCover, setLoadingCover] = useState(false);
    const [coverError, setCoverError] = useState('');

    const fetchCoverImage = async (url) => {
        if (!url || !url.startsWith('http') || !selectedTrip) return;

        setLoadingCover(true);
        setCoverError('');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('Timeout'), 5000);

        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl, { signal: controller.signal });
            const data = await response.json();

            if (data.contents) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.contents, 'text/html');
                const ogImage = doc.querySelector('meta[property="og:image"]');

                if (ogImage && ogImage.content) {
                    handleUpdateTrip(selectedTrip.id, { image_url: ogImage.content });
                } else {
                    setCoverError('Could not find cover image automatically.');
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn('Cover image fetch timed out.');
            } else {
                console.error('Failed to fetch cover image', err);
            }
            setCoverError('Scan timed out. Please paste direct Image Address below.');
        } finally {
            clearTimeout(timeoutId);
            setLoadingCover(false);
        }
    };

    const handleDeleteTrip = (id) => {
        deleteTrip(id);
        setSelectedTripId(null);
    };

    /* The paperwork: the sheet, the photos album, the budget, and burning
       the file. It used to hold a permanent right-hand column open on every
       view of every trip — a column opened twice a journey, charging the
       timeline a sixth of the page on all the other days. It is a tab now,
       and costs nothing until it is asked for. */
    const setupPanels = selectedTrip ? (
        <div className="expedition__setup">
            {/* MISSION INTELLIGENCE */}
            <Card variant="flat" as="div">
                <details className="panel">
                    <summary className="panel__summary">Mission Intelligence</summary>

                    <div className="panel__body">
                        <div className="field">
                            <Field
                                label="GOOGLE PHOTOS ALBUM"
                                type="text"
                                value={selectedTrip.google_photos_url || ''}
                                onChange={(e) => handleUpdateTrip(selectedTrip.id, { google_photos_url: e.target.value })}
                                onBlur={(e) => fetchCoverImage(e.target.value)}
                                placeholder="https://photos.google.com/..."
                            />
                            <div className="panel__row">
                                {selectedTrip.google_photos_url && (
                                    <a href={selectedTrip.google_photos_url} target="_blank" rel="noopener noreferrer" className="atlas-link">
                                        Open Album
                                    </a>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="panel__row-end"
                                    onClick={() => fetchCoverImage(selectedTrip.google_photos_url)}
                                    disabled={loadingCover}
                                >
                                    {loadingCover ? 'Scanning...' : 'Extract Cover Image'}
                                </Button>
                            </div>
                            {coverError && (
                                <p className="panel__error" role="status">{coverError}</p>
                            )}
                        </div>

                        <div className="field">
                            <Field
                                label="GOOGLE SHEET ITINERARY"
                                type="text"
                                value={selectedTrip.google_sheets_url || ''}
                                onChange={(e) => handleUpdateTrip(selectedTrip.id, { google_sheets_url: e.target.value })}
                                placeholder="https://docs.google.com/spreadsheets/..."
                            />
                            {/* The link is only half of it: the sheet
                                can be written from the trip, and an
                                older one read back into it. */}
                            <TripSheet
                                trip={selectedTrip}
                                data={planner}
                                onUpdateTrip={handleUpdateTrip}
                                onImport={planner.applyImport}
                            />
                        </div>

                        <div className="panel__section">
                            <div className="panel__row">
                                <span className="field__label">ADDITIONAL ASSETS</span>
                                <Button icon label="Add link" className="panel__row-end" onClick={handleAddLink}>+</Button>
                            </div>
                            <ul className="asset-list">
                                {(selectedTrip.links || []).map((link, idx) => (
                                    <li key={idx} className="asset">
                                        <input
                                            className="input asset__title"
                                            value={link.title}
                                            onChange={(e) => handleUpdateLink(idx, 'title', e.target.value)}
                                            placeholder="Title"
                                            aria-label={`Asset ${idx + 1} title`}
                                        />
                                        <input
                                            className="input asset__url"
                                            value={link.url}
                                            onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                                            placeholder="URL"
                                            aria-label={`Asset ${idx + 1} URL`}
                                        />
                                        {link.url && (
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="atlas-link"
                                                aria-label={`Open ${link.title || 'asset'}`}
                                            >
                                                ↗
                                            </a>
                                        )}
                                        <ConfirmButton
                                            icon="×"
                                            label={`Delete link ${link.title || idx + 1}`}
                                            onConfirm={() => handleDeleteLink(idx)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </details>
            </Card>

            {/* LOGISTICS */}
            <Card variant="flat" as="div">
                <details className="panel">
                    <summary className="panel__summary">Logistics</summary>

                    <div className="panel__body">
                        <Field
                            label="ESTIMATED BUDGET"
                            type="number"
                            hint="In dollars."
                            value={selectedTrip.budget}
                            onChange={(e) => handleUpdateTrip(selectedTrip.id, { budget: parseInt(e.target.value) || 0 })}
                        />

                        <div className="field">
                            <Field
                                label="COVER IMAGE URL"
                                type="text"
                                value={selectedTrip.image_url}
                                onChange={(e) => handleUpdateTrip(selectedTrip.id, { image_url: e.target.value })}
                                placeholder="https://..."
                            />
                            {selectedTrip.image_url && (
                                <span
                                    className="cover-preview"
                                    style={{ backgroundImage: `url(${selectedTrip.image_url})` }}
                                />
                            )}
                        </div>

                        <ConfirmButton
                            className="burn-file"
                            block
                            label="Burn Mission File"
                            confirmLabel="CONFIRM: BURN THIS FILE?"
                            onConfirm={() => handleDeleteTrip(selectedTrip.id)}
                        >
                            Burn Mission File
                        </ConfirmButton>
                    </div>
                </details>
            </Card>
        </div>
    ) : null;

    return (
        <div className="page atlas">
            <PageHeader
                title="The Atlas"
                icon={<GiWorld />}
                subtitle={selectedTrip ? `Expedition Log: ${selectedTrip.destination}` : 'The Map Room'}
                actions={selectedTrip && (
                    <Button variant="primary" onClick={() => setSelectedTripId(null)}>
                        Save &amp; Return to Map
                    </Button>
                )}
            />

            {/* VIEW: MAP ROOM (Index) */}
            {!selectedTrip && (
                <div className="atlas__room">
                    {/* One pin per trip, and no map at all until at least one
                        of them knows where it is. */}
                    <div className="atlas__map">
                        <InteractiveMap
                            stops={trips.map((t) => ({
                                key: t.id,
                                lat: t.coordinates?.lat,
                                lng: t.coordinates?.lng,
                                label: t.destination,
                                sub: t.start_date || 'Date TBD',
                                badge: '',
                                onOpen: () => setSelectedTripId(t.id),
                            }))}
                        />
                    </div>

                    <ul className="atlas__grid">
                        {/* New Trip Card */}
                        <li>
                            <button type="button" className="atlas-new" onClick={handleAddTrip}>
                                <GiCompass size={40} />
                                <span className="atlas-new__label">Chart New Course</span>
                            </button>
                        </li>

                        {/* Existing Trips */}
                        {trips.map(trip => (
                            <li key={trip.id}>
                                <Card
                                    as="article"
                                    interactive
                                    padded={false}
                                    className="trip-card"
                                    style={{ '--trip-cover': trip.image_url ? `url(${trip.image_url})` : 'none' }}
                                >
                                    <span className="trip-card__tag">Mission File</span>
                                    {/* Something to recognise the trip by. A
                                        photo if there is one; otherwise the
                                        flags of the places it goes, big enough
                                        to actually read from the grid. */}
                                    {!trip.image_url && tripFlags[trip.id]?.length > 0 && (
                                        <span className="trip-card__flags" aria-hidden="true">
                                            {tripFlags[trip.id].join('')}
                                        </span>
                                    )}
                                    <span className="trip-card__title">
                                        <button
                                            type="button"
                                            className="trip-card__open"
                                            onClick={() => setSelectedTripId(trip.id)}
                                        >
                                            {trip.destination}
                                        </button>
                                    </span>
                                    <span className="trip-card__meta">
                                        <Tag tone={STATUS_TONE[trip.status] || 'default'}>{trip.status}</Tag>
                                        <span>{trip.start_date || 'Date TBD'}</span>
                                    </span>
                                </Card>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* VIEW: EXPEDITION DETAIL */}
            {selectedTrip && (
                <div className="expedition">

                    <Card className="expedition__log">
                        <Field label="DESTINATION" className="expedition__destination">
                            <input
                                className="input expedition__destination-input"
                                value={selectedTrip.destination}
                                onChange={(e) => handleUpdateTrip(selectedTrip.id, { destination: e.target.value })}
                            />
                        </Field>

                        <div className="field-row">
                            <Field label="STATUS">
                                <select
                                    className="select"
                                    value={selectedTrip.status}
                                    onChange={(e) => handleUpdateTrip(selectedTrip.id, { status: e.target.value })}
                                >
                                    <option>Dreaming</option>
                                    <option>Planned</option>
                                    <option>Completed</option>
                                </select>
                            </Field>
                            {/* Not a plain date input writing through on
                                change: typing 2026 into the year sends 0002,
                                0020 and 0202 on the way, each of which was
                                saved — and the saved value then replaced what
                                she was typing, so the year could never be
                                finished. */}
                            <Field label="DEPARTURE">
                                <DateField
                                    value={selectedTrip.start_date}
                                    onCommit={(v) => handleUpdateTrip(selectedTrip.id, { start_date: v || null })}
                                    aria-label="Departure"
                                />
                            </Field>
                            {/* end_date has been in the schema all along and was
                                never on screen. The day planner needs it: it is
                                what says how many days a trip has. */}
                            <Field label="RETURN">
                                <DateField
                                    value={selectedTrip.end_date}
                                    onCommit={(v) => handleUpdateTrip(selectedTrip.id, { end_date: v || null })}
                                    aria-label="Return"
                                />
                            </Field>
                        </div>

                        <Field
                            label="NOTES / ITINERARY"
                            as="textarea"
                            className="expedition__notes"
                            value={selectedTrip.notes || ''}
                            onChange={(e) => handleUpdateTrip(selectedTrip.id, { notes: e.target.value })}
                            placeholder="Rough plan..."
                        />

                        {/* The day-by-day plan: the spreadsheet's spine. */}
                        <section className="expedition__planner">
                            <h3 className="section-title">The Days</h3>
                            <TripPlanner
                                trip={selectedTrip}
                                onUpdateTrip={handleUpdateTrip}
                                planner={planner}
                                onIdeaUsed={ideas.markPromoted}
                                setup={setupPanels}
                            />
                        </section>

                        {/* Where a thought goes before it has a date. */}
                        <TripIdeas
                            trip={selectedTrip}
                            days={planner.days}
                            legs={planner.legs}
                            hooks={ideas}
                            onAddToDay={planner.addItem}
                            onBook={planner.addStay}
                        />

                        {/* The bottom of the page: what is still unfinished,
                            and the pins and the map. None of it decides
                            anything — the trip can be planned start to finish
                            without opening any of it — so none of it sits
                            halfway up looking like the next step. */}
                        <section className="expedition__loose">
                            <TripLooseEnds
                                tripDates={planner.tripDates}
                                legs={planner.legs}
                                stays={planner.stays}
                            />

                            <div className="field">
                            <span className="field__label">WAYPOINTS (CLICK MAP TO ADD)</span>
                            <ul className="waypoints">
                                {currentWaypoints.map((wp, idx) => (
                                    <li key={wp.id || idx} className="waypoint">
                                        <GiPin className="waypoint__pin" />
                                        <input
                                            className="input waypoint__name"
                                            value={wp.name || ''}
                                            onChange={(e) => updateWaypoint(wp.id, selectedTrip.id, { name: e.target.value })}
                                            placeholder="Waypoint Name"
                                            aria-label={`Waypoint ${idx + 1} name`}
                                        />
                                        <ConfirmButton
                                            icon="×"
                                            label={`Delete waypoint ${wp.name || idx + 1}`}
                                            onConfirm={() => deleteWaypoint(wp.id, selectedTrip.id)}
                                        />
                                    </li>
                                ))}
                                {currentWaypoints.length === 0 && (
                                    <li className="waypoints__empty">Click map to drop the first pin.</li>
                                )}
                            </ul>

                            {/* The cities she planned, in order, plus any pin
                                she dropped by hand. */}
                            <InteractiveMap
                                route
                                stops={[
                                    ...routeStops,
                                    /* A dot rather than a number: a pin she
                                       dropped is a note, not the fourth stop. */
                                    ...currentWaypoints.map((wp) => ({
                                        key: `wp-${wp.id}`,
                                        lat: wp.lat,
                                        lng: wp.lng,
                                        label: wp.name || 'Waypoint',
                                        sub: 'Dropped by hand',
                                        badge: '',
                                    })),
                                ]}
                                isEditing={true}
                                onLocationSelect={(latlng) => {
                                    handleAddWaypoint(`Stop #${currentWaypoints.length + 1}`, latlng.lat, latlng.lng);
                                }}
                            />
                            {locating && <p className="atlas__locating">Finding these places…</p>}
                            </div>
                        </section>
                    </Card>


                </div>
            )}
        </div>
    );
};

export default Atlas;
