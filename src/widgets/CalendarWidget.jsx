import React, { useState, useEffect } from 'react';
import { GiSundial, GiNotebook, GiEclipse } from 'react-icons/gi';
import { useSettings } from '../hooks/useSettings';
import WidgetCard from '../components/WidgetCard';
import EmptyState from '../components/EmptyState';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import '../styles/CalendarWidget.css';

// Hoisted: defining this inside CalendarWidget remounted the iframe — and so
// re-fetched the Google embed — on every parent render.
const CalendarFrame = ({ url }) => {
    if (!url) return null;

    return (
        <iframe
            src={url}
            className="calendar-frame"
            frameBorder="0"
            scrolling="no"
            title="Google Calendar"
        ></iframe>
    );
};

const CalendarWidget = () => {
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
            <WidgetCard title="Google Chronometer" icon={<GiSundial />} span={2}>
                <EmptyState
                    icon={<GiSundial />}
                    message="The Chronometer is disconnected."
                    hint="Enter your Calendar ID in Settings to activate the viewing glass."
                />
            </WidgetCard>
        );
    }

    const embedUrl = getEmbedUrl(calendarId);

    return (
        <>
            <WidgetCard
                title="Google Chronometer"
                icon={<GiSundial />}
                span={3}
                className="calendar-widget"
                actions={
                    <>
                        <Button
                            icon
                            size="sm"
                            className={`calendar-btn-icon ${isDarkMode ? 'active' : ''}`}
                            onClick={toggleDarkMode}
                            aria-pressed={isDarkMode}
                            label={isDarkMode ? 'Disable calendar dark mode' : 'Enable calendar dark mode'}
                        >
                            <GiEclipse />
                        </Button>
                        <Button
                            icon
                            size="sm"
                            onClick={() => setIsExpanded(true)}
                            label="Expanse mode (fullscreen)"
                        >
                            ⤢
                        </Button>
                        <Button
                            as="a"
                            size="sm"
                            variant="ghost"
                            href="https://calendar.google.com/calendar/r/settings/export"
                            target="_blank"
                            rel="noopener noreferrer"
                            label="Open Google Calendar import settings"
                        >
                            <GiNotebook /> Import .ics
                        </Button>
                    </>
                }
            >
                {/* The Portal (Iframe) */}
                <div className={`calendar-portal ${isDarkMode ? 'dark' : ''}`}>
                    <CalendarFrame url={embedUrl} />
                </div>

                {/* Note about appearance */}
                <p className="calendar-note">
                    Appearance is controlled by Google. Toggle the eclipse for spectral contrast.
                </p>
            </WidgetCard>

            {/* Expanse Mode — a real dialog: focus trap, Escape, focus restore. */}
            <Modal
                open={isExpanded}
                onClose={() => setIsExpanded(false)}
                title="Chronometer Expanse"
                size="full"
            >
                <div className={`calendar-portal ${isDarkMode ? 'dark' : ''}`}>
                    <CalendarFrame url={embedUrl} />
                </div>
            </Modal>
        </>
    );
};
export default CalendarWidget;
