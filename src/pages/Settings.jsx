import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useDashboardSettings, ALL_WIDGETS } from '../hooks/useDashboardSettings';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../hooks/useSettings';
import { THEME_CHARACTER } from '../configs/themes.jsx';
import { GiGears } from 'react-icons/gi';
import { Button, Card, PageHeader, Field } from '../components/ui';
import CalendarFeeds from '../components/CalendarFeeds';
import '../styles/Settings.css';

/**
 * One theme swatch.
 *
 * A theme is not only a palette — THEME_CHARACTER also carries the border
 * style, corner radius, shadow, tracking, case and density. The old preview
 * showed three colours and "Abc" in the display face, so 8-Bit's hard square
 * rule and Cottagecore's soft 16px corners looked identical until you applied
 * them. The tile now declares the previewed theme's colour variables on
 * itself, which lets the character values (`3px double var(--border-gold)`)
 * resolve against *that* theme rather than the one currently on screen.
 */
const ThemeSwatch = ({ theme, selected, onSelect, onKeyDown }) => {
    const vars = theme.cssVars;
    const character = THEME_CHARACTER[theme.id] || {};

    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className="theme-card"
            onClick={() => onSelect(theme.id)}
            onKeyDown={onKeyDown}
        >
            <span
                className="theme-preview"
                style={{
                    '--border-gold': vars['--border-gold'],
                    '--border-dim': vars['--border-dim'],
                    '--accent-gold': vars['--accent-gold'],
                    background: vars['--bg-panel'],
                    border: character['--rule'],
                    borderRadius: character['--radius-md'],
                    boxShadow: character['--shadow-sm'],
                    padding: `calc(var(--space-2) * ${character['--density'] || 1})`
                }}
            >
                <span
                    className="theme-preview-text"
                    style={{
                        color: vars['--text-main'],
                        fontFamily: vars['--font-display'],
                        fontSize: character['--text-sm'],
                        letterSpacing: character['--tracking-heading'],
                        textTransform: character['--case-heading']
                    }}
                >
                    Portal
                </span>
                <span
                    className="theme-preview-chip"
                    style={{
                        color: vars['--text-gold'],
                        fontFamily: vars['--font-body'],
                        fontSize: character['--text-2xs'],
                        borderRadius: character['--radius-sm'],
                        border: character['--rule-hair'],
                        letterSpacing: character['--tracking-label'],
                        textTransform: character['--case-heading']
                    }}
                >
                    Button
                </span>
                {/* The palette, shown rather than described. A theme's eight
                    hues are the part you cannot infer from one accent chip. */}
                <span className="theme-preview-palette">
                    {(theme.palette || []).map((c) => (
                        <span
                            key={c.hex}
                            className="theme-preview-hue"
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                        />
                    ))}
                </span>
            </span>
            <span className="theme-name">{theme.name}</span>
        </button>
    );
};

const Settings = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { themeId, setTheme, allThemes } = useTheme();
    const { settings, updateSetting } = useSettings();
    const [calendarId, setCalendarId] = React.useState('');
    const [sheets, setSheets] = React.useState({ endpoint: '', secret: '' });
    const [msg, setMsg] = React.useState('');
    const [status, setStatus] = React.useState('idle');
    const { toggleWidget, isEnabled } = useDashboardSettings();

    React.useEffect(() => {
        setSheets({
            endpoint: settings.sheetsEndpoint || '',
            secret: settings.sheetsSecret || '',
        });
        if (settings.calendarId) {
            setCalendarId(settings.calendarId);
        }
    }, [settings.calendarId, settings.sheetsEndpoint, settings.sheetsSecret]);

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

    // Arrow keys walk the radio group, as a radio group is expected to.
    const handleThemeKeys = (e) => {
        const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
        if (!keys.includes(e.key)) return;
        e.preventDefault();
        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const i = allThemes.findIndex((t) => t.id === themeId);
        const next = allThemes[(i + step + allThemes.length) % allThemes.length];
        setTheme(next.id);
    };

    return (
        <div className="page settings-container">
            <PageHeader
                title="Settings"
                icon={<GiGears />}
                subtitle="How the portal looks, what it shows, and who it answers to."
            />

            {/* Vibe Selection */}
            <Card>
                <h2 className="section-title settings-section-title">
                    <span>Portal Vibe (Theme)</span>
                    <span className="settings-section-subtitle">Shift the aesthetic of your reality</span>
                </h2>
                <div className="theme-picker" role="radiogroup" aria-label="Portal vibe">
                    {allThemes.map((t) => (
                        <ThemeSwatch
                            key={t.id}
                            theme={t}
                            selected={themeId === t.id}
                            onSelect={setTheme}
                            onKeyDown={handleThemeKeys}
                        />
                    ))}
                </div>
            </Card>

            {/* Dashboard Customization */}
            <Card>
                <h2 className="section-title settings-section-title">
                    <span>Dashboard Manifest</span>
                    <span className="settings-section-subtitle">Select your active widgets</span>
                </h2>
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
            </Card>

            {/* Account Management */}
            <Card>
                <h2 className="section-title settings-section-title">
                    <span>Identity (Account)</span>
                    {user && <span className="settings-section-subtitle">{user.email}</span>}
                </h2>

                <div className="account-actions">
                    <div className="account-info">
                        <p className="account-info-label">Sign Out</p>
                        <p className="account-info-desc">Close the ledger and secure the archives.</p>
                    </div>
                    <Button variant="danger" onClick={handleLogout}>
                        Sign Out
                    </Button>
                </div>
            </Card>

            {/* Integrations */}
            <Card>
                <h2 className="section-title settings-section-title">
                    Connected Spirits (Integrations)
                </h2>

                {/* The feed reader comes first: it is the one that shows real
                    event titles, and the one that works on a phone. */}
                <CalendarFeeds />

                <h3 className="section-title settings-subsection-title">
                    Google embed (fallback)
                </h3>

                <div className="stack">
                    <p className="integration-note">
                        The embedded Google view, by <strong>Calendar ID</strong> (e.g.{' '}
                        <code>yourname@gmail.com</code>). Several are allowed, separated by commas.
                    </p>
                    <p className="integration-warning">
                        The embed only ever shows what a calendar is <em>shared</em> as. A calendar
                        shared as &ldquo;free/busy&rdquo; renders every event as &ldquo;Busy&rdquo;
                        with no titles, and one that is not shared at all shows nothing unless this
                        browser is signed into the Google account that owns it &mdash; which is why
                        it is usually blank on a phone. Add a secret address above instead.
                    </p>

                    <div className="integration-input-group">
                        <Field
                            label="Google Calendar ID"
                            className="integration-field"
                            type="text"
                            value={calendarId}
                            onChange={(e) => setCalendarId(e.target.value)}
                            placeholder="e.g. personal@gmail.com, work@company.com"
                        />
                        <Button variant="primary" onClick={handleSave}>
                            Save ID
                        </Button>
                    </div>
                    {msg && (
                        <p
                            role="status"
                            className={status === 'success' ? 'integration-msg' : 'integration-warning'}
                        >
                            {msg}
                        </p>
                    )}
                </div>
            </Card>

            <Card variant="flat" as="section" className="integration-card">
                <h2 className="section-title">Google Sheets</h2>
                <div className="integration-body">
                    <p className="integration-note">
                        The Atlas can write a trip out as a spreadsheet in your template&rsquo;s
                        shape, and read an older sheet back in. It does that through a small
                        script you deploy under your <em>own</em> Google account, so nothing of
                        Google&rsquo;s is stored here &mdash; no API key, no sign-in.
                    </p>
                    <p className="integration-note">
                        Setup instructions are at the top of{' '}
                        <code>scripts/me-portal-sheets.gs</code> in the repo: paste it into{' '}
                        <a href="https://script.google.com" target="_blank" rel="noopener noreferrer">
                            script.google.com
                        </a>
                        , deploy it as a Web app, and paste the <code>/exec</code> URL here.
                    </p>

                    <div className="integration-input-group">
                        <Field
                            label="Apps Script URL"
                            className="integration-field"
                            type="text"
                            value={sheets.endpoint}
                            onChange={(e) => setSheets((s) => ({ ...s, endpoint: e.target.value }))}
                            placeholder="https://script.google.com/macros/s/.../exec"
                        />
                    </div>
                    <div className="integration-input-group">
                        <Field
                            label="Shared phrase"
                            className="integration-field"
                            type="text"
                            value={sheets.secret}
                            onChange={(e) => setSheets((s) => ({ ...s, secret: e.target.value }))}
                            placeholder="the same phrase you put in the script"
                        />
                        <Button
                            variant="primary"
                            onClick={() => {
                                updateSetting('sheetsEndpoint', sheets.endpoint.trim());
                                updateSetting('sheetsSecret', sheets.secret.trim());
                            }}
                        >
                            Save
                        </Button>
                    </div>
                    {/* Worth saying plainly: this phrase is not a password of
                        Google's, it is the one thing stopping a stranger who
                        guesses the URL from writing to the Drive. */}
                    <p className="integration-warning">
                        The phrase must match the <code>SHARED_SECRET</code> line in the script
                        exactly. It is what stops anyone who finds the URL from writing to your
                        Drive.
                    </p>
                </div>
            </Card>

            <p className="settings-footer">
                "The details are not the details. They make the design."
            </p>
        </div>
    );
};

export default Settings;
