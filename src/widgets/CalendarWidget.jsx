import React, { useState, useEffect, useMemo } from 'react';
import { GiSundial, GiNotebook, GiEclipse, GiCycle, GiPositionMarker } from 'react-icons/gi';
import { useSettings } from '../hooks/useSettings';
import { useCalendar } from '../hooks/useCalendar';
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

/* "Today", "Tomorrow", then a real date — a bare date makes you do arithmetic
   to answer the only question being asked. */
const dayLabel = (iso) => {
    const date = new Date(`${iso}T00:00:00`);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((date - midnight) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

const timeLabel = (event) => (event.allDay
    ? 'All day'
    : new Date(event.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));

/**
 * The agenda. Grouped by day, finished events dropped, so the first thing on
 * screen is the next thing that happens.
 */
const Agenda = ({ events }) => {
    // Held in state and refreshed on a timer rather than read during render:
    // reading the clock mid-render is impure, and this way an event that ends
    // while the page is open drops off by itself. Starts at 0 so the very
    // first paint shows everything rather than nothing.
    const [now, setNow] = useState(0);
    useEffect(() => {
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    const days = useMemo(() => {
        const grouped = new Map();
        for (const event of events) {
            // Finished an hour ago is clutter; still running is the most
            // relevant thing on the page.
            if (new Date(event.end || event.start).getTime() < now) continue;
            const key = new Date(event.start).toLocaleDateString('en-CA');
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(event);
        }
        return [...grouped.entries()];
    }, [events, now]);

    if (!days.length) {
        return <p className="agenda__empty">Nothing coming up.</p>;
    }

    return (
        <ol className="agenda">
            {days.map(([day, dayEvents]) => (
                <li key={day} className="agenda__day">
                    <h3 className="agenda__day-title">{dayLabel(day)}</h3>
                    <ul className="agenda__events">
                        {dayEvents.map((event) => (
                            <li key={event.id} className="agenda__event">
                                <span
                                    className="agenda__dot"
                                    style={{ background: event.color || 'var(--text-gold)' }}
                                    aria-hidden="true"
                                />
                                <span className="agenda__time">{timeLabel(event)}</span>
                                <span className="agenda__body">
                                    <span className="agenda__title">{event.title}</span>
                                    {event.location && (
                                        <span className="agenda__where">
                                            <GiPositionMarker aria-hidden="true" /> {event.location}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </li>
            ))}
        </ol>
    );
};

const CalendarWidget = () => {
    const { settings, updateSetting } = useSettings();
    const { events, feeds, savedFeeds, loading, error, refresh } = useCalendar();
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

    // Feeds win over the embed. They carry real event titles, they work when
    // the browser is not signed into Google, and they render in this app's own
    // type rather than inside Google's iframe.
    if (savedFeeds.length > 0) {
        const broken = feeds.filter((f) => !f.ok);
        return (
            <WidgetCard
                title="Chronometer"
                icon={<GiSundial />}
                span={2}
                scroll
                actions={
                    <Button icon size="sm" onClick={refresh} label="Refresh calendars" disabled={loading}>
                        <GiCycle />
                    </Button>
                }
            >
                {loading && events.length === 0 ? (
                    <p className="agenda__empty">Reading your calendars…</p>
                ) : (
                    <Agenda events={events} />
                )}

                {error && <p className="agenda__error">{error}</p>}

                {/* Naming the calendar that failed matters: with several feeds,
                    "something went wrong" leaves her guessing which. */}
                {broken.map((f) => (
                    <p key={f.id} className="agenda__error">{f.name}: {f.error}</p>
                ))}

                {feeds.length > 1 && (
                    <p className="agenda__legend">
                        {feeds.filter((f) => f.ok).map((f) => (
                            <span key={f.id} className="agenda__legend-item">
                                <span className="agenda__dot" style={{ background: f.color }} aria-hidden="true" />
                                {f.name}
                            </span>
                        ))}
                    </p>
                )}
            </WidgetCard>
        );
    }

    if (!calendarId) {
        return (
            <WidgetCard title="Chronometer" icon={<GiSundial />} span={2}>
                <EmptyState
                    icon={<GiSundial />}
                    message="The Chronometer is disconnected."
                    hint="Add a calendar's secret iCal address in Settings — it shows real event titles and works on your phone."
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
