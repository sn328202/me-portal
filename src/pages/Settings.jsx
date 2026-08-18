import React from 'react';
import WidgetCard from '../components/WidgetCard';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useDashboardSettings, ALL_WIDGETS } from '../hooks/useDashboardSettings';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../hooks/useSettings';
import '../styles/Settings.css';

const Settings = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { themeId, setTheme, allThemes } = useTheme();
    const { settings, updateSetting } = useSettings();
    const [calendarId, setCalendarId] = React.useState('');
    const [msg, setMsg] = React.useState('');
    const [status, setStatus] = React.useState('idle');
    const { toggleWidget, isEnabled } = useDashboardSettings();

    React.useEffect(() => {
        if (settings.calendarId) {
            setCalendarId(settings.calendarId);
        }
    }, [settings.calendarId]);

    const handleLogout = async () => {
        await signOut();
        navigate('/auth');
    };

    const handleSave = async () => {
        if (!user) return;
        await updateSetting('calendarId', calendarId.trim());
        setMsg('ID Saved. The Chronometer has been updated.');
        setStatus('success');
        window.dispatchEvent(new Event('calendar-config-updated'));

        setTimeout(() => {
            setMsg('');
            setStatus('idle');
        }, 3000);
    };

    return (
        <div className="settings-container">
            <h1 className="settings-title">Settings</h1>

            {/* Vibe Selection */}
            <WidgetCard>
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        <span>Portal Vibe (Theme)</span>
                        <span className="settings-section-subtitle">Shift the aesthetic of your reality</span>
                    </h3>
                    <div className="theme-picker">
                        {allThemes.map((t) => (
                            <div
                                key={t.id}
                                className={`theme-card ${themeId === t.id ? 'active' : ''}`}
                                onClick={() => setTheme(t.id)}
                            >
                                <div className="theme-preview" style={{
                                    backgroundColor: t.cssVars['--bg-main'],
                                    borderColor: t.cssVars['--border-gold']
                                }}>
                                    <div className="theme-preview-text" style={{ color: t.cssVars['--text-main'], fontFamily: t.cssVars['--font-display'] }}>
                                        Abc
                                    </div>
                                    <div className="theme-preview-accent" style={{ backgroundColor: t.cssVars['--text-gold'] }}></div>
                                </div>
                                <span className="theme-name">{t.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </WidgetCard>

            <div style={{ height: '2rem' }}></div>

            {/* Dashboard Customization */}
            <WidgetCard>
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        <span>Dashboard Manifest</span>
                        <span className="settings-section-subtitle">Select your active widgets</span>
                    </h3>
                    <div className="widget-manifest">
                        {ALL_WIDGETS.map((widget) => (
                            <div key={widget.id} className="widget-option">
                                <input
                                    type="checkbox"
                                    id={`widget-${widget.id}`}
                                    className="widget-checkbox"
                                    checked={isEnabled(widget.id)}
                                    onChange={() => toggleWidget(widget.id)}
                                />
                                <label htmlFor={`widget-${widget.id}`} className="widget-option-details">
                                    <span className="widget-option-label">{widget.label}</span>
                                    <span className="widget-option-desc">{widget.description}</span>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            </WidgetCard>

            <div style={{ height: '2rem' }}></div>

            {/* Account Management */}
            <WidgetCard>
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        <span>Identity (Account)</span>
                        {user && <span className="settings-section-subtitle">{user.email}</span>}
                    </h3>

                    <div className="account-actions">
                        <div className="account-info">
                            <p className="account-info-label">Sign Out</p>
                            <p className="account-info-desc">Close the ledger and secure the archives.</p>
                        </div>
                        <button onClick={handleLogout} className="logout-btn">
                            Sign Out
                        </button>
                    </div>
                </div>
            </WidgetCard>

            <div style={{ height: '2rem' }}></div>

            {/* Integrations */}
            <WidgetCard>
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        Connected Spirits (Integrations)
                    </h3>

                    <div style={{ marginBottom: '2rem' }}>
                        <label className="account-info-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            Google Calendar ID
                        </label>
                        <p className="integration-note">
                            To embed the "Real Deal," we need your **Calendar ID** (e.g., <code>yourname@gmail.com</code>).<br />
                            For multiple calendars, separate them with a comma.
                        </p>
                        <p className="integration-warning">
                            Note: Your calendar must be "Public" or you must be logged into Google in this browser for it to appear.
                        </p>

                        <div className="integration-input-group">
                            <input
                                type="text"
                                value={calendarId}
                                onChange={(e) => setCalendarId(e.target.value)}
                                placeholder="e.g. personal@gmail.com, work@company.com"
                                className="integration-input"
                            />
                            <button onClick={handleSave} className="save-btn">
                                Save ID
                            </button>
                        </div>
                        {msg && <p style={{ color: status === 'success' ? 'var(--text-gold)' : 'var(--accent-crimson)', fontSize: '0.8rem', mt: '0.5rem' }}>{msg}</p>}
                    </div>
                </div>
            </WidgetCard>

            <div className="settings-footer">
                "The details are not the details. They make the design."
            </div>
        </div>
    );
};

export default Settings;
