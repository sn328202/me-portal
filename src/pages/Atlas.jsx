import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GiWorld, GiCompass, GiPin } from 'react-icons/gi';
import InteractiveMap from '../components/InteractiveMap';
import { Button, Card, ConfirmButton, Field, Modal, PageHeader, Tag } from '../components/ui';
import { useAtlas } from '../hooks/useAtlas';

/* Lazily, and deliberately.
   Imported statically, the Table Book is pulled in by both this page and the
   Daydream, so Rollup hoists it into whichever chunk it reaches first and the
   two chunks end up referring to each other. The page then dies on load with
   "Cannot access 'T' before initialization" — a temporal dead zone between
   chunks, not a bug in either file. A dynamic import gives it a chunk of its
   own and the question stops existing. */
const TableBook = lazy(() => import('./TableBook'));
import { SHELVES, onShelf as onTripShelf, shelfCounts as tripShelfCounts, describeShape } from '../utils/tripShape';
import { supabase } from '../lib/supabase';
import TripPlanner from '../components/TripPlanner';
import TripSheet from '../components/TripSheet';
import TripIdeas from '../components/TripIdeas';
import TripLooseEnds from '../components/TripLooseEnds';
import DateField from '../components/DateField';
import TripCard from '../components/TripCard';
import TripRoute from '../components/TripRoute';
import { GiSunrise, GiGears } from 'react-icons/gi';
import { useTripDays } from '../hooks/useTripDays';
import { useTripIdeas } from '../hooks/useTripIdeas';
import { flagsForLegs } from '../utils/flags';
import { atlasStats, costOfTrip } from '../utils/atlasStats';
import { formatMoney } from '../utils/tripCosts';
import { todayLocal } from '../utils/planShelf';
import { legDestination, isTravelLeg } from '../utils/tripLegs';
import '../styles/Atlas.css';

const STATUS_TONE = {
    Dreaming: 'gold',
    Planned: 'default',
    Completed: 'green'
};

const Atlas = () => {
    const { trips, waypoints, addTrip, updateTrip, deleteTrip, addWaypoint, updateWaypoint, deleteWaypoint } = useAtlas();

    /* Which shelf of the Atlas is showing. Since the Daydream merged in, this
       list holds a week in Switzerland and a Saturday with Will side by side.
       They are the same record — a day IS a trip one day long — and this is
       how you say which you are looking for without them being two rooms
       again. Read off the dates, never off a flag she has to maintain. */
    const [shelf, setShelf] = useState('all');

    /* Two rooms at the top of the Atlas, because a booking is not a trip: it
       exists before you know which day it belongs to, it arrives from a
       confirmation email, and it goes held -> went. She asked for the Table
       Book to live here and to hold every booking, not only restaurants.
       ?tab=table is how the old /tablebook address arrives. */
    const [room, setRoom] = useState(() => (params.get('tab') === 'table' ? 'table' : 'trips'));

    const chooseRoom = useCallback((next) => {
        setRoom(next);
        setParams((prev) => {
            const nextParams = new URLSearchParams(prev);
            if (next === 'table') nextParams.set('tab', 'table');
            else nextParams.delete('tab');
            return nextParams;
        }, { replace: true });
    }, [setParams]);
    const shelfTally = useMemo(() => tripShelfCounts(trips), [trips]);
    const shelved = useMemo(() => onTripShelf(trips, shelf), [trips, shelf]);

    // The Atlas is an index (The Map Room) and a detail view (the Expedition
    // Log). That is navigation, not tabs — the view follows the selection.
    /* ?trip=<id> opens straight into an expedition. It is how an itinerary
       links to the trip day it was sent to — she planned the day in one room
       and wants to see it in the other, and until now that meant going to the
       Atlas and remembering which trip it was. */
    const [params, setParams] = useSearchParams();
    /* A trip id is a bigint, so `trips` holds numbers. A URL holds text.
       Reading `?trip=9` straight into state gave the string "9", which never
       matched any `t.id`, so following a link back into a trip quietly landed
       on the Atlas index instead — the deep link looked like it did nothing. */
    const [selectedTripId, setSelectedTripIdRaw] = useState(() => {
        const raw = params.get('trip');
        const n = raw === null ? NaN : Number(raw);
        return Number.isFinite(n) ? n : null;
    });

    const setSelectedTripId = useCallback((id) => {
        setSelectedTripIdRaw(id);
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (id) next.set('trip', id);
            else next.delete('trip');
            return next;
        }, { replace: true });
    }, [setParams]);

    const selectedTrip = trips.find((t) => String(t.id) === String(selectedTripId));
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
    /* The paperwork, and the way in for a trip that already exists on a
       spreadsheet. */
    const [setupOpen, setSetupOpen] = useState(false);
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

    /* What every trip comes to, worked out the same way the trip's own page
       works it out — three queries for the whole shelf rather than opening
       each trip to find out. Only on the map room: inside a trip this is
       already on screen and better. */
    const [costByTrip, setCostByTrip] = useState({});

    useEffect(() => {
        if (selectedTripId || !trips.length) return undefined;
        let alive = true;

        (async () => {
            const ids = trips.map((t) => t.id);
            const [{ data: days }, { data: stays }] = await Promise.all([
                supabase.from('atlas_days').select('*').in('trip_id', ids),
                supabase.from('atlas_stays').select('*').in('trip_id', ids),
            ]);
            if (!alive) return;

            const dayIds = (days || []).map((d) => d.id);
            const { data: dayItems } = dayIds.length
                ? await supabase.from('atlas_day_items').select('*').in('day_id', dayIds)
                : { data: [] };
            if (!alive) return;

            const itemsByDay = {};
            for (const it of dayItems || []) (itemsByDay[it.day_id] ||= []).push(it);

            const daysByTrip = {};
            for (const d of days || []) (daysByTrip[d.trip_id] ||= []).push(d);
            const staysByTrip = {};
            for (const st of stays || []) (staysByTrip[st.trip_id] ||= []).push(st);

            setCostByTrip(Object.fromEntries(trips.map((t) => [
                t.id,
                costOfTrip(t, daysByTrip[t.id] || [], itemsByDay, staysByTrip[t.id] || []),
            ])));
        })();

        return () => { alive = false; };
    }, [trips, selectedTripId]);

    /* The shelf taken together. The map already answers "where have I been";
       these are the other questions a pile of trips raises and none of them
       needed more than arithmetic. */
    const stats = useMemo(
        () => atlasStats({ trips, legsByTrip, costByTrip, today: todayLocal() }),
        [trips, legsByTrip, costByTrip]
    );

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
                {/* Open. This was a fold, which made sense when these
                    panels held a permanent column open beside the timeline —
                    but they live in a dialog you opened on purpose now, and
                    a dialog whose contents are hidden behind two more clicks
                    is a dialog that has not opened. */}
                <section className="panel">
                    <h3 className="panel__summary">Mission Intelligence</h3>

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
                </section>
            </Card>

            {/* LOGISTICS */}
            <Card variant="flat" as="div">
                {/* Open. This was a fold, which made sense when these
                    panels held a permanent column open beside the timeline —
                    but they live in a dialog you opened on purpose now, and
                    a dialog whose contents are hidden behind two more clicks
                    is a dialog that has not opened. */}
                <section className="panel">
                    <h3 className="panel__summary">Logistics</h3>

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
                </section>
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
                    <>
                        {/* Setup is where a trip starts when there already is
                            one: the sheet import brings a whole itinerary in.
                            It lived inside the day planner, which refuses to
                            render until the trip has dates — so on a brand new
                            expedition, the one thing that could fill it in was
                            behind the thing it was meant to fill in. */}
                        {/* Same size as the two beside it: they are three
                            things you do with the whole expedition, and one of
                            them looking like a lesser control was only an
                            accident of where it used to live. */}
                        <Button onClick={() => setSetupOpen(true)}>
                            <GiGears /> Setup
                        </Button>
                        {/* Things you do with the whole expedition, together. */}
                        <TripCard
                            trip={selectedTrip}
                            days={planner.days}
                            itemsByDay={planner.items}
                        />
                        <Button variant="primary" onClick={() => setSelectedTripId(null)}>
                            Save &amp; Return to Map
                        </Button>
                    </>
                )}
            />

            {!selectedTrip && (
                <div className="atlas__rooms" role="tablist" aria-label="The Atlas">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={room === 'trips'}
                        className={`atlas__roomtab${room === 'trips' ? ' is-on' : ''}`}
                        onClick={() => chooseRoom('trips')}
                    >
                        🗺️ Expeditions
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={room === 'table'}
                        className={`atlas__roomtab${room === 'table' ? ' is-on' : ''}`}
                        onClick={() => chooseRoom('table')}
                    >
                        📖 The Table Book
                    </button>
                </div>
            )}

            {/* Every booking, held and historic — a table, a tasting, a show,
                a train. It lives here because it is a thing you do with a
                trip, and because it existed before the trip did. */}
            {!selectedTrip && room === 'table' && (
                <Suspense fallback={<p className="atlas__waiting">Opening the Table Book…</p>}>
                    <TableBook embedded />
                </Suspense>
            )}

            {/* VIEW: MAP ROOM (Index) */}
            {!selectedTrip && room === 'trips' && (
                <div className="atlas__room">
                    {/* The shelf, taken together. The map below answers "where
                        have I been" and nothing else; these are the other
                        questions a pile of trips raises, and none of them
                        needed more than arithmetic over what is already
                        stored. */}
                    {trips.length > 0 && (
                        <section className="atlas__stats" aria-label="Your Atlas so far">
                            <div className="atlas__stat">
                                <strong>{stats.countries.length}</strong>
                                <span>{stats.countries.length === 1 ? 'country' : 'countries'}</span>
                                {stats.countries.length > 0 && (
                                    <p className="atlas__stat-flags" aria-hidden="true">
                                        {stats.countries.map((c) => c.flag).join(' ')}
                                    </p>
                                )}
                            </div>

                            <div className="atlas__stat">
                                <strong>{stats.trips}</strong>
                                <span>{stats.trips === 1 ? 'expedition' : 'expeditions'}</span>
                                <p className="atlas__stat-note">
                                    {stats.been} been · {stats.ahead} ahead
                                </p>
                            </div>

                            {/* Shown only once something is priced. A running
                                total of nothing is not a fact about her
                                travelling, it is a fact about her typing. */}
                            {stats.spend > 0 && (
                                <>
                                    <div className="atlas__stat">
                                        <strong>{formatMoney(stats.spend)}</strong>
                                        <span>all in, per person</span>
                                        <p className="atlas__stat-note">
                                            across {stats.priced} priced {stats.priced === 1 ? 'trip' : 'trips'}
                                        </p>
                                    </div>

                                    <div className="atlas__stat">
                                        <strong>{formatMoney(stats.average)}</strong>
                                        <span>a trip, on average</span>
                                        {stats.dearest && (
                                            <p className="atlas__stat-note">
                                                dearest: {stats.dearest.trip.destination} at {formatMoney(stats.dearest.cost)}
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </section>
                    )}

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

                    <div className="atlas__shelves" role="tablist" aria-label="What to show">
                        {SHELVES.map((s2) => (
                            <button
                                key={s2.id}
                                type="button"
                                role="tab"
                                aria-selected={shelf === s2.id}
                                className={`atlas__shelf${shelf === s2.id ? ' is-on' : ''}`}
                                onClick={() => setShelf(s2.id)}
                                disabled={s2.id !== 'all' && !shelfTally[s2.id]}
                            >
                                {s2.label}
                                <em>{shelfTally[s2.id]}</em>
                            </button>
                        ))}
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
                        {shelved.map(trip => (
                            <li key={trip.id}>
                                {/* A poster only when there is a photo to
                                    make one out of. Without one the card was
                                    still 200px of black-over-nothing — a
                                    muddy rectangle with a flag stranded in
                                    the middle of it and the name pushed to
                                    the very bottom.

                                    The "Mission File" corner tag has gone
                                    with it: it was dark on dark, and every
                                    card said the same thing, so it denoted
                                    nothing. */}
                                <Card
                                    as="article"
                                    interactive
                                    padded={false}
                                    className={`trip-card${trip.image_url ? '' : ' trip-card--bare'}`}
                                    style={{ '--trip-cover': trip.image_url ? `url(${trip.image_url})` : 'none' }}
                                >
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
                                        {/* How long it is, which is also what
                                            kind of thing it is. */}
                                        <em className="trip-card__shape">{describeShape(trip)}</em>
                                    </span>
                                </Card>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* The sheet links, the photo album and the budget — and the
                spreadsheet import, which is why this is reachable before a
                trip has anything in it. */}
            {selectedTrip && (
                <Modal
                    open={setupOpen}
                    onClose={() => setSetupOpen(false)}
                    title="Setup"
                    size="wide"
                >
                    <div className="trip-planner__setup">{setupPanels}</div>
                </Modal>
            )}

            {/* VIEW: EXPEDITION DETAIL */}
            {selectedTrip && (
                <div className="expedition">

                    {/* One overview rather than four boxes. What the trip
                        is and when it runs, then the days themselves — which
                        is the thing she is actually here for.

                        These used to be a Card that wrapped everything below
                        it, including the Route/Timeline/Cards toggle. Which
                        is why switching view appeared to change the
                        where-and-when box: it was inside it. */}
                    <Card className="expedition__log">
                        <div className="expedition__bar">
                            <input
                                className="expedition__destination-input"
                                aria-label="Destination"
                                value={selectedTrip.destination}
                                onChange={(e) => handleUpdateTrip(selectedTrip.id, { destination: e.target.value })}
                                placeholder="Where are you going?"
                            />

                            <div className="expedition__facts">
                                <select
                                    className="select expedition__status"
                                    aria-label="Status"
                                    value={selectedTrip.status}
                                    onChange={(e) => handleUpdateTrip(selectedTrip.id, { status: e.target.value })}
                                >
                                    <option>Dreaming</option>
                                    <option>Planned</option>
                                    <option>Completed</option>
                                </select>

                                {/* Not plain date inputs writing through on
                                    change: typing 2026 into the year sends
                                    0002, 0020 and 0202 on the way, each of
                                    which was saved — and the saved value then
                                    replaced what she was typing, so the year
                                    could never be finished. */}
                                <span className="expedition__when">
                                    <DateField
                                        value={selectedTrip.start_date}
                                        onCommit={(v) => handleUpdateTrip(selectedTrip.id, { start_date: v || null })}
                                        aria-label="Departure"
                                    />
                                    <i aria-hidden="true">→</i>
                                    <DateField
                                        value={selectedTrip.end_date}
                                        onCommit={(v) => handleUpdateTrip(selectedTrip.id, { end_date: v || null })}
                                        aria-label="Return"
                                    />
                                </span>

                            </div>
                        </div>

                        {/* Where and when: the cities, and the dates they run
                            between. This was a fourth entry in the
                            Route/Timeline/Cards toggle, which was wrong twice
                            over — it is not a way of looking at the days, it
                            is what the days are *made out of*, and it was
                            sitting a page away from the thing it feeds.

                            Fill in weather is here because it can only be
                            answered from a city and a date, and those are
                            these. It was in the cost header; before that it
                            was nowhere near either. */}
                        <section className="expedition__where">
                            <div className="expedition__where-head">
                                <h3 className="section-title">Where and when</h3>
                                <Button
                                    size="sm"
                                    onClick={planner.refreshWeather}
                                    disabled={planner.weatherBusy || !planner.legs.length}
                                    title={planner.legs.length
                                        ? 'Look up the weather for these cities on these dates'
                                        : 'Add a city and its dates first — that is what the forecast is looked up from'}
                                >
                                    <GiSunrise /> {planner.weatherBusy ? 'Checking…' : 'Fill in weather'}
                                </Button>
                            </div>

                            {planner.weatherMessage && (
                                <p className="expedition__weather-note" role="status">{planner.weatherMessage}</p>
                            )}

                            <TripRoute
                                legs={planner.legs}
                                stays={planner.stays}
                                days={planner.days}
                                items={planner.items}
                                costs={planner.costs}
                                currency={selectedTrip.currency || 'USD'}
                                onAdd={planner.addLeg}
                                onUpdate={planner.updateLeg}
                                onDelete={planner.deleteLeg}
                            />
                        </section>

                        {/* Open when there is something in it, folded away
                            when there is not — a full-height textarea holding
                            nothing was taking a third of the page above the
                            plan. */}
                        <details className="expedition__notes-fold" open={Boolean(selectedTrip.notes)}>
                            <summary>
                                Notes
                                {selectedTrip.notes
                                    ? <em>{selectedTrip.notes.trim().split(/\s+/).length} words</em>
                                    : <em>empty</em>}
                            </summary>
                            <textarea
                                className="expedition__notes"
                                aria-label="Notes and rough itinerary"
                                value={selectedTrip.notes || ''}
                                onChange={(e) => handleUpdateTrip(selectedTrip.id, { notes: e.target.value })}
                                placeholder="Rough plan..."
                            />
                        </details>

                        {/* The day-by-day plan: the spreadsheet's spine, and
                            the reason for the page. */}
                        <section className="expedition__planner">
                            <h3 className="section-title">The Days</h3>
                            <TripPlanner
                                trip={selectedTrip}
                                onUpdateTrip={handleUpdateTrip}
                                planner={planner}
                                onIdeaUsed={ideas.markPromoted}
                            />
                        </section>
                    </Card>

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

                </div>
            )}
        </div>
    );
};

export default Atlas;
