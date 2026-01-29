import React, { useState } from 'react';
import { GiWorld, GiCompass, GiAirplaneDeparture, GiCalendar, GiPin } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import InteractiveMap from '../components/InteractiveMap';
import { useAtlas } from '../hooks/useAtlas';

const Atlas = () => {
    const { trips, waypoints, addTrip, updateTrip, deleteTrip, addWaypoint, updateWaypoint, deleteWaypoint, loading } = useAtlas();

    const [activeTab, setActiveTab] = useState('Map Room');
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
            setActiveTab('Expedition');
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

    // ... Cover Image Logic Omitted for brevity, keep as is ...
    // ... Delete Logic Omitted for brevity, keep as is ...
    // ... BUT we need to replace the waypoint section in the JSX ...

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
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl, { signal: controller.signal });
            const data = await response.json();

            if (data.contents) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.contents, "text/html");
                const ogImage = doc.querySelector('meta[property="og:image"]');

                if (ogImage && ogImage.content) {
                    handleUpdateTrip(selectedTrip.id, { image_url: ogImage.content });
                } else {
                    setCoverError('Could not find cover image automatically.');
                }
            }
        } catch (err) {
            console.error("Failed to fetch cover image", err);
            setCoverError('Scan timed out. Please paste direct Image Address below.');
        } finally {
            clearTimeout(timeoutId);
            setLoadingCover(false);
        }
    };

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const handleDeleteTrip = (id) => {
        if (confirmDeleteId === id) {
            deleteTrip(id);
            setSelectedTripId(null);
            setConfirmDeleteId(null);
            setActiveTab('Map Room');
        } else {
            setConfirmDeleteId(id);
            setTimeout(() => setConfirmDeleteId(null), 3000);
        }
    };

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '2rem' }}>
            <h1 className="box-header" style={{
                fontSize: '2rem',
                marginBottom: 'var(--space-lg)',
                color: 'var(--text-main)',
                borderBottom: 'var(--border-double)',
                paddingBottom: 'var(--space-md)',
                display: 'flex', alignItems: 'center', gap: '1rem'
            }}>
                <GiWorld size={40} color="var(--text-gold)" /> The Atlas
            </h1>

            {/* Navigation Tabs (Simulated) */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => { setActiveTab('Map Room'); setSelectedTripId(null); }}
                        style={{
                            padding: '0.5rem 1rem',
                            border: '1px solid var(--border-gold)',
                            background: activeTab === 'Map Room' ? 'var(--bg-hover)' : 'transparent',
                            color: activeTab === 'Map Room' ? 'var(--text-gold)' : 'var(--text-muted)',
                            fontFamily: 'var(--font-display)',
                            cursor: 'pointer'
                        }}
                    >
                        The Map Room
                    </button>
                    {selectedTrip && (
                        <button
                            onClick={() => setActiveTab('Expedition')}
                            style={{
                                padding: '0.5rem 1rem',
                                border: '1px solid var(--border-gold)',
                                background: activeTab === 'Expedition' ? 'var(--bg-hover)' : 'transparent',
                                color: activeTab === 'Expedition' ? 'var(--text-gold)' : 'var(--text-muted)',
                                fontFamily: 'var(--font-display)',
                                cursor: 'pointer'
                            }}
                        >
                            Expedition Log: {selectedTrip.destination}
                        </button>
                    )}
                </div>

                {selectedTrip && activeTab === 'Expedition' && (
                    <button
                        onClick={() => { setActiveTab('Map Room'); setSelectedTripId(null); }}
                        style={{
                            padding: '0.5rem 1.5rem',
                            background: 'var(--text-gold)',
                            color: 'var(--bg-main)',
                            border: 'none',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            borderRadius: '2px'
                        }}
                    >
                        Save & Return to Map
                    </button>
                )}
            </div>

            {/* VIEW: MAP ROOM (Index) */}
            {activeTab === 'Map Room' && (
                <div>
                    <div style={{ marginBottom: '2rem' }}>
                        <InteractiveMap trips={trips.map(t => ({
                            ...t,
                            waypoints: waypoints[t.id] || []
                        }))} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
                        {/* New Trip Card */}
                        <div
                            onClick={handleAddTrip}
                            style={{
                                height: '200px',
                                border: '2px dashed var(--border-dim)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'var(--text-muted)',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-gold)'; e.currentTarget.style.color = 'var(--text-gold)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-dim)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                            <GiCompass size={40} />
                            <span style={{ marginTop: '1rem', fontFamily: 'var(--font-display)' }}>Chart New Course</span>
                        </div>

                        {/* Existing Trips */}
                        {trips.map(trip => (
                            <div key={trip.id}
                                onClick={() => { setSelectedTripId(trip.id); setActiveTab('Expedition'); }}
                                style={{
                                    height: '200px',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    border: '1px solid var(--border-dim)',
                                    backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url(${trip.image_url})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                                    padding: '1.5rem'
                                }}
                            >
                                <div style={{ color: 'var(--text-gold)', fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                                    {trip.destination}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    <span>{trip.status}</span>
                                    <span>{trip.start_date || 'Date TBD'}</span>
                                </div>
                                <div style={{
                                    position: 'absolute', top: '10px', right: '10px',
                                    background: 'var(--accent-crimson)', color: '#fff',
                                    padding: '2px 8px', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px'
                                }}>
                                    Mission File
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VIEW: EXPEDITION DETAIL */}
            {activeTab === 'Expedition' && selectedTrip && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>

                    {/* LEFT COLUMN: Itinerary & Identity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <WidgetCard>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <input
                                    value={selectedTrip.destination}
                                    onChange={(e) => handleUpdateTrip(selectedTrip.id, { destination: e.target.value })}
                                    style={{
                                        background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-gold)',
                                        color: 'var(--text-gold)', fontSize: '2rem', fontFamily: 'var(--font-display)',
                                        width: '100%'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>STATUS</label>
                                    <select
                                        value={selectedTrip.status}
                                        onChange={(e) => handleUpdateTrip(selectedTrip.id, { status: e.target.value })}
                                        style={{ width: '100%', padding: '0.5rem', background: '#222', border: '1px solid #444', color: '#eee' }}
                                    >
                                        <option>Dreaming</option>
                                        <option>Planned</option>
                                        <option>Completed</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>DEPARTURE</label>
                                    <input
                                        type="date"
                                        value={selectedTrip.start_date || ''}
                                        onChange={(e) => handleUpdateTrip(selectedTrip.id, { start_date: e.target.value })}
                                        style={{ width: '100%', padding: '0.5rem', background: '#222', border: '1px solid #444', color: '#eee' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>NOTES / ITINERARY</label>
                                <textarea
                                    value={selectedTrip.notes || ''}
                                    onChange={(e) => handleUpdateTrip(selectedTrip.id, { notes: e.target.value })}
                                    placeholder="Rough plan..."
                                    style={{
                                        width: '100%', minHeight: '200px',
                                        background: 'var(--bg-main)', border: '1px solid var(--border-dim)',
                                        color: 'var(--text-main)', padding: '1rem', fontFamily: 'var(--font-mono)', lineHeight: '1.6', marginBottom: '1rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>WAYPOINTS (CLICK MAP TO ADD)</label>
                                <div style={{ marginBottom: '1rem', maxHeight: '150px', overflowY: 'auto' }}>
                                    {currentWaypoints.map((wp, idx) => (
                                        <div key={wp.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                            <GiPin color="var(--text-gold)" />
                                            <input
                                                value={wp.name || ''}
                                                onChange={(e) => updateWaypoint(wp.id, selectedTrip.id, { name: e.target.value })}
                                                placeholder="Waypoint Name"
                                                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #444', color: 'var(--text-main)', flex: 1 }}
                                            />
                                            <button
                                                onClick={() => deleteWaypoint(wp.id, selectedTrip.id)}
                                                style={{ color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    {currentWaypoints.length === 0 && (
                                        <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Click map to drop the first pin.</div>
                                    )}
                                </div>

                                <InteractiveMap
                                    trips={[{ ...selectedTrip, waypoints: currentWaypoints, coordinates: tripCenter }]}
                                    isEditing={true}
                                    onLocationSelect={(latlng) => {
                                        handleAddWaypoint(`Stop #${currentWaypoints.length + 1}`, latlng.lat, latlng.lng);
                                    }}
                                    selectedLocation={tripCenter}
                                />
                            </div>
                        </WidgetCard>
                    </div>

                    {/* RIGHT COLUMN: Assets & Logistics */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* MISSION INTELLIGENCE */}
                        <WidgetCard>
                            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-gold)', fontFamily: 'var(--font-display)' }}>Mission Intelligence</h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>GOOGLE PHOTOS ALBUM</label>
                                <input
                                    type="text"
                                    value={selectedTrip.google_photos_url || ''}
                                    onChange={(e) => handleUpdateTrip(selectedTrip.id, { google_photos_url: e.target.value })}
                                    onBlur={(e) => fetchCoverImage(e.target.value)}
                                    placeholder="https://photos.google.com/..."
                                    style={{ background: 'transparent', border: '1px solid var(--border-dim)', padding: '0.5rem', color: 'var(--text-main)', width: '100%' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', alignItems: 'center' }}>
                                    {selectedTrip.google_photos_url && (
                                        <a href={selectedTrip.google_photos_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--text-gold)', textDecoration: 'underline' }}>
                                            Open Album
                                        </a>
                                    )}
                                    <button
                                        onClick={() => fetchCoverImage(selectedTrip.google_photos_url)}
                                        disabled={loadingCover}
                                        style={{ fontSize: '0.7rem', color: loadingCover ? 'var(--text-muted)' : 'var(--text-main)', border: '1px solid var(--border-dim)', padding: '0.2rem 0.5rem', cursor: loadingCover ? 'wait' : 'pointer' }}
                                    >
                                        {loadingCover ? 'Scanning...' : 'Extract Cover Image'}
                                    </button>
                                </div>
                                {coverError && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-crimson)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                                        {coverError}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>GOOGLE SHEET ITINERARY</label>
                                <input
                                    type="text"
                                    value={selectedTrip.google_sheets_url || ''}
                                    onChange={(e) => handleUpdateTrip(selectedTrip.id, { google_sheets_url: e.target.value })}
                                    placeholder="https://docs.google.com/spreadsheets/..."
                                    style={{ background: 'transparent', border: '1px solid var(--border-dim)', padding: '0.5rem', color: 'var(--text-main)', width: '100%' }}
                                />
                                {selectedTrip.google_sheets_url && (
                                    <a href={selectedTrip.google_sheets_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-gold)', textDecoration: 'underline' }}>
                                        Open Ledger
                                    </a>
                                )}
                            </div>

                            <div style={{ marginTop: '2rem', borderTop: '1px dashed var(--border-gold)', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ADDITIONAL ASSETS</label>
                                    <button onClick={handleAddLink} style={{ fontSize: '1.2rem', color: 'var(--text-gold)', cursor: 'pointer' }}>+</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {(selectedTrip.links || []).map((link, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input
                                                value={link.title}
                                                onChange={(e) => handleUpdateLink(idx, 'title', e.target.value)}
                                                placeholder="Title"
                                                style={{ flex: 1, background: '#222', border: 'none', padding: '0.3rem', color: '#ccc', fontSize: '0.8rem' }}
                                            />
                                            <input
                                                value={link.url}
                                                onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                                                placeholder="URL"
                                                style={{ flex: 2, background: '#222', border: 'none', padding: '0.3rem', color: '#888', fontSize: '0.8rem' }}
                                            />
                                            {link.url && (
                                                <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-gold)' }}>↗</a>
                                            )}
                                            <button onClick={() => handleDeleteLink(idx)} style={{ color: '#d32f2f', cursor: 'pointer' }}>×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </WidgetCard>

                        {/* LOGISTICS */}
                        <WidgetCard>
                            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-gold)', fontFamily: 'var(--font-display)' }}>Logistics</h3>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>ESTIMATED BUDGET</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>$</span>
                                    <input
                                        type="number"
                                        value={selectedTrip.budget}
                                        onChange={(e) => handleUpdateTrip(selectedTrip.id, { budget: parseInt(e.target.value) || 0 })}
                                        style={{ background: 'transparent', border: '1px solid var(--border-dim)', padding: '0.5rem', color: 'var(--text-main)', width: '100%' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>COVER IMAGE URL</label>
                                <input
                                    type="text"
                                    value={selectedTrip.image_url}
                                    onChange={(e) => handleUpdateTrip(selectedTrip.id, { image_url: e.target.value })}
                                    placeholder="https://..."
                                    style={{ background: 'transparent', border: '1px solid var(--border-dim)', padding: '0.5rem', color: 'var(--text-main)', width: '100%', marginBottom: '0.5rem' }}
                                />
                                {selectedTrip.image_url && (
                                    <div style={{
                                        height: '100px', width: '100%',
                                        borderRadius: '4px', overflow: 'hidden',
                                        border: '1px solid var(--border-dim)',
                                        backgroundImage: `url(${selectedTrip.image_url})`,
                                        backgroundSize: 'cover', backgroundPosition: 'center'
                                    }} />
                                )}
                            </div>

                            <button
                                onClick={() => handleDeleteTrip(selectedTrip.id)}
                                style={{
                                    width: '100%', padding: '0.8rem',
                                    border: `1px solid ${confirmDeleteId === selectedTrip.id ? 'var(--text-gold)' : 'var(--accent-crimson)'}`,
                                    background: confirmDeleteId === selectedTrip.id ? 'var(--accent-crimson)' : 'transparent',
                                    color: confirmDeleteId === selectedTrip.id ? '#fff' : 'var(--accent-crimson)',
                                    marginTop: '2rem', cursor: 'pointer', opacity: 1,
                                    transition: 'all 0.2s ease',
                                    fontWeight: confirmDeleteId === selectedTrip.id ? 'bold' : 'normal'
                                }}
                            >
                                {confirmDeleteId === selectedTrip.id ? 'CONFIRM: BURN THIS FILE?' : 'Burn Mission File'}
                            </button>
                        </WidgetCard>
                    </div>

                </div>
            )}
        </div >
    );
};

export default Atlas;
