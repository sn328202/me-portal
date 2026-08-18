import React, { useState, useEffect } from 'react';
import { GiSundial, GiNotebook, GiEclipse } from 'react-icons/gi';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import '../styles/CalendarWidget.css';

const CalendarWidget = () => {
    const { user } = useAuth();
    const { settings, updateSetting } = useSettings();
    const [calendarId, setCalendarId] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Load Configuration & Identity
    useEffect(() => {
        if (settings.calendarId) {
            setCalendarId(settings.calendarId);
        }
        setIsDarkMode(!!settings.calendarDarkMode);
    }, [settings.calendarId, settings.calendarDarkMode]);

    useEffect(() => {
        const handleUpdate = () => {
            // Manual refresh if needed, but useSettings should handle it
        };
        window.addEventListener('calendar-config-updated', handleUpdate);
        return () => window.removeEventListener('calendar-config-updated', handleUpdate);
    }, []);

    const toggleDarkMode = async () => {
        const newVal = !isDarkMode;
        setIsDarkMode(newVal);
        await updateSetting('calendarDarkMode', newVal);
    };

    // Helper to construct the dark mode URL
    const getEmbedUrl = (idString) => {
        if (!idString) return '';
        const ids = idString.split(',').map(s => s.trim()).filter(s => s);
        if (ids.length === 0) return '';

        const base = "https://calendar.google.com/calendar/embed";
        const params = new URLSearchParams({
            ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            showTitle: '0',
            showNav: '1',
            showDate: '1',
            showPrint: '0',
            showTabs: '0',
            showCalendars: '0',
            showTz: '0',
            mode: 'WEEK',
            height: '600',
            wkst: '1',
            bgcolor: '#d7cec7', // We keep this as base. Invert will make it dark slate/blue.
            color: '#3e2723'
        });

        // Append each calendar source
        ids.forEach(id => params.append('src', id));

        return `${base}?${params.toString()}`;
    };

    if (!calendarId) {
        return (
            <div className="calendar-disconnected">
                <GiSundial size={48} className="calendar-disconnected-icon" />
                <h3>The Chronometer is Disconnected</h3>
                <p>Please enter your <strong>Calendar ID</strong> in Settings to activate the viewing glass.</p>
            </div>
        );
    }

    // Modal Content
    const CalendarFrame = ({ className }) => {
        const url = getEmbedUrl(calendarId);
        if (!url) return null;

        return (
            <iframe
                src={url}
                className={`calendar-frame ${className || ''}`}
                style={{
                    filter: isDarkMode ? 'invert(0.9) hue-rotate(180deg)' : 'none'
                }}
                frameBorder="0"
                scrolling="no"
                title="Google Calendar"
            ></iframe>
        );
    };

    return (
        <>
            {/* Standard Widget View */}
            <div className="calendar-widget">
                {/* Header / Frame */}
                <div className="calendar-header">
                    <h3 className="calendar-title">
                        <GiSundial /> Google Chronometer
                    </h3>
                    <div className="calendar-controls">
                        <button
                            onClick={toggleDarkMode}
                            className={`calendar-btn-icon ${isDarkMode ? 'active' : ''}`}
                            title={isDarkMode ? "Disable Dark Mode" : "Enable Dark Mode"}
                            aria-label={isDarkMode ? 'Disable calendar dark mode' : 'Enable calendar dark mode'}
                        >
                            <GiEclipse />
                        </button>
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="calendar-btn-expand"
                            title="Expanse Mode (Fullscreen)"
                        >
                            ⤢
                        </button>
                        <a
                            href="https://calendar.google.com/calendar/r/settings/export"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="calendar-btn-import"
                            title="Open Google Calendar Import Settings"
                        >
                            <GiNotebook /> Import .ics
                        </a>
                    </div>
                </div>

                {/* The Portal (Iframe) */}
                <div className={`calendar-portal ${isDarkMode ? 'dark' : ''}`}>
                    <CalendarFrame />
                </div>

                {/* Note about appearance */}
                <div className="calendar-note">
                    * Appearance controlled by Google. Toggle <GiEclipse style={{ verticalAlign: 'middle' }} /> for spectral contrast.
                </div>
            </div>

            {/* Expanse Mode Modal */}
            {isExpanded && (
                <div className="calendar-expanse-overlay">
                    <div className="calendar-expanse-content">
                        <div className="calendar-expanse-header">
                            <h2 className="calendar-expanse-title">
                                <GiSundial /> Chronometer Expanse
                            </h2>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="calendar-close-btn"
                            >
                                CLOSE [ESC]
                            </button>
                        </div>
                        <div className={`calendar-portal ${isDarkMode ? 'dark' : ''}`}>
                            <CalendarFrame />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
export default CalendarWidget;
