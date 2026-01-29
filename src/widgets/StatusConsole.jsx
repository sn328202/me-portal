import React, { useState } from 'react';
import { GiControlTower } from 'react-icons/gi';

const StatusConsole = () => {
    // Persistent URL state
    const [url, setUrl] = useState(localStorage.getItem('me_portal_status_url') || '');
    const [editMode, setEditMode] = useState(!url);

    const handleSave = (e) => {
        e.preventDefault();
        const input = e.target.elements.urlUrl.value;
        localStorage.setItem('me_portal_status_url', input);
        setUrl(input);
        setEditMode(false);
    };

    return (
        <div style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
            {/* Header / Controls */}
            <div style={{
                padding: '1rem',
                background: '#d7cec7',
                borderBottom: '1px solid #a1887f',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', color: '#3e2723', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <GiControlTower /> Status Monitor
                </h3>
                <button
                    onClick={() => setEditMode(!editMode)}
                    style={{ fontSize: '0.8rem', textDecoration: 'underline', background: 'transparent', border: 'none', cursor: 'pointer', color: '#5d4037' }}
                >
                    {editMode ? 'Cancel' : 'Configure Signal'}
                </button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, position: 'relative', background: '#eee' }}>
                {editMode ? (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.9)'
                    }}>
                        <form onSubmit={handleSave} style={{ textAlign: 'center', width: '100%', maxWidth: '400px' }}>
                            <p style={{ marginBottom: '1rem', color: '#3e2723' }}>Enter the URL of your Dashboard (Retool, Google Data Studio, etc.)</p>
                            <input
                                name="urlUrl"
                                defaultValue={url}
                                placeholder="https://..."
                                type="url"
                                style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #795548' }}
                                required
                            />
                            <button type="submit" style={{ padding: '0.5rem 2rem', background: '#5d4037', color: '#fff', border: 'none' }}>
                                Establish Link
                            </button>
                        </form>
                    </div>
                ) : (
                    <iframe
                        src={url}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="Status Dashboard"
                    />
                )}
            </div>
        </div>
    );
};

export default StatusConsole;
