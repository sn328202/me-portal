import React from 'react';
import WidgetCard from '../components/WidgetCard';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [calendarId, setCalendarId] = React.useState(localStorage.getItem('me_portal_calendar_id') || '');
    const [msg, setMsg] = React.useState('');
    const [status, setStatus] = React.useState('idle');

    const handleLogout = async () => {
        await signOut();
        navigate('/auth');
    };

    const handleSave = () => {
        if (!calendarId) return;
        localStorage.setItem('me_portal_calendar_id', calendarId.trim());
        setMsg('ID Saved. The Chronometer has been updated.');
        setStatus('success'); // Re-using existing state logic if suitable, or simplifying.
        window.dispatchEvent(new Event('calendar-config-updated'));

        // clear message after 3 seconds
        setTimeout(() => {
            setMsg('');
            setStatus('idle');
        }, 3000);
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="box-header" style={{
                fontSize: '2rem',
                marginBottom: 'var(--space-lg)',
                color: 'var(--text-main)',
                borderBottom: 'var(--border-double)',
                paddingBottom: 'var(--space-md)'
            }}>
                Settings
            </h1>

            {/* Account Management */}
            <WidgetCard>
                <div style={{ padding: 'var(--space-xl)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Identity (Account)</span>
                        {user && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{user.email}</span>}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '4px' }}>
                        <div>
                            <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-main)' }}>Sign Out</p>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Close the ledger and secure the archives.</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{
                                padding: '0.5rem 1.5rem',
                                background: 'transparent',
                                border: '1px solid var(--accent-crimson)',
                                color: 'var(--accent-crimson)',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </WidgetCard>

            <div style={{ height: '2rem' }}></div>

            <WidgetCard>
                <div style={{ padding: 'var(--space-xl)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                        Connected Spirits (Integrations)
                    </h3>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                            Google Calendar ID
                        </label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            To embed the "Real Deal," we need your **Calendar ID** (e.g., <code>yourname@gmail.com</code>).
                            <br />
                            Go to <em>Google Calendar Settings &gt; Integrate calendar &gt; Calendar ID</em>.
                        </p>
                        <p style={{ fontSize: '0.8rem', color: '#c62828', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                            Note: Your calendar must be "Public" or you must be logged into Google in this browser for it to appear.
                        </p>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input
                                type="text"
                                value={calendarId}
                                onChange={(e) => setCalendarId(e.target.value)}
                                placeholder="e.g. nehasule@gmail.com"
                                style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-gold)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                            />
                            <button
                                onClick={handleSave}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'var(--accent-gold)',
                                    color: '#fff', border: 'none', cursor: 'pointer'
                                }}
                            >
                                Save ID
                            </button>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '3rem' }}>
                        "The details are not the details. They make the design."
                    </div>
                </div>
            </WidgetCard>
        </div >
    );
};

export default Settings;
