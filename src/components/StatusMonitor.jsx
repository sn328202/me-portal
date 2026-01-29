import React, { useState, useEffect } from 'react';
import { GiSatelliteCommunication, GiGears } from 'react-icons/gi';

const StatusMonitor = () => {
    const [embedUrl, setEmbedUrl] = useState(() => localStorage.getItem('me_portal_retool_url') || '');
    const [isEditing, setIsEditing] = useState(!localStorage.getItem('me_portal_retool_url'));
    const [inputVal, setInputVal] = useState('');

    useEffect(() => {
        if (embedUrl) {
            setInputVal(embedUrl);
        }
    }, [embedUrl]);

    const handleSave = (e) => {
        e.preventDefault();
        if (inputVal.trim()) {
            localStorage.setItem('me_portal_retool_url', inputVal.trim());
            setEmbedUrl(inputVal.trim());
            setIsEditing(false);
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#121212', borderRadius: '4px', border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
            {/* Header / Controls */}
            <div style={{
                padding: '0.5rem 1rem',
                background: '#1a1a1a',
                borderBottom: '1px solid var(--border-gold)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-gold)' }}>
                    <GiSatelliteCommunication size={20} />
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>Signal Feed</span>
                </div>

                <button
                    onClick={() => setIsEditing(!isEditing)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.8rem'
                    }}
                >
                    <GiGears /> Configure Signal
                </button>
            </div>

            {/* Configuration Mode */}
            {isEditing && (
                <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-main)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>Establish Connection</h3>
                    <p style={{ marginBottom: '1.5rem', opacity: 0.7, maxWidth: '400px', textAlign: 'center' }}>
                        Enter the public URL or Embed URL of your Retool Dashboard (or any other embeddable status page).
                    </p>
                    <form onSubmit={handleSave} style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '500px' }}>
                        <input
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            placeholder="https://retool.com/embed/..."
                            style={{
                                flex: 1,
                                padding: '0.8rem',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-gold)',
                                color: 'var(--text-main)',
                                fontFamily: 'monospace'
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                padding: '0 1.5rem',
                                background: 'var(--accent-gold)',
                                color: 'var(--bg-main)',
                                border: 'none',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Connect
                        </button>
                    </form>
                </div>
            )}

            {/* Live Feed */}
            {!isEditing && embedUrl && (
                <iframe
                    src={embedUrl}
                    title="Status Monitor"
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        background: '#fff' // Retool usually needs light bg backing or it looks weird loading
                    }}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                />
            )}
        </div>
    );
};

export default StatusMonitor;
