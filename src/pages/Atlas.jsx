import React, { useState } from 'react';
import { GiWorld, GiCompass, GiPin } from 'react-icons/gi';
import InteractiveMap from '../components/InteractiveMap';
import { Button, Card, ConfirmButton, Field, PageHeader, Tag } from '../components/ui';
import { useAtlas } from '../hooks/useAtlas';
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

    // Derive main "center" coordinates from first waypoint or trip field if exists (backwards compat)
    const tripCenter = (currentWaypoints.length > 0) ? [currentWaypoints[0].lat, currentWaypoints[0].lng] : (selectedTrip?.coordinates || null);

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
                    <div className="atlas__map">
                        <InteractiveMap trips={trips.map(t => ({
                            ...t,
                            waypoints: waypoints[t.id] || []
                        }))} />
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

                    {/* PRIMARY COLUMN: the expedition itself */}
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
                            <Field
                                label="DEPARTURE"
                                type="date"
                                value={selectedTrip.start_date || ''}
                                onChange={(e) => handleUpdateTrip(selectedTrip.id, { start_date: e.target.value })}
                            />
                        </div>

                        <Field
                            label="NOTES / ITINERARY"
                            as="textarea"
                            className="expedition__notes"
                            value={selectedTrip.notes || ''}
                            onChange={(e) => handleUpdateTrip(selectedTrip.id, { notes: e.target.value })}
                            placeholder="Rough plan..."
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

                            <InteractiveMap
                                trips={[{ ...selectedTrip, waypoints: currentWaypoints, coordinates: tripCenter }]}
                                isEditing={true}
                                onLocationSelect={(latlng) => {
                                    handleAddWaypoint(`Stop #${currentWaypoints.length + 1}`, latlng.lat, latlng.lng);
                                }}
                                selectedLocation={tripCenter}
                            />
                        </div>
                    </Card>

                    {/* SECONDARY COLUMN: the paperwork. Quieter, and folded away. */}
                    <aside className="expedition__config">

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
                                        {selectedTrip.google_sheets_url && (
                                            <a href={selectedTrip.google_sheets_url} target="_blank" rel="noopener noreferrer" className="atlas-link">
                                                Open Ledger
                                            </a>
                                        )}
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
                    </aside>

                </div>
            )}
        </div>
    );
};

export default Atlas;
