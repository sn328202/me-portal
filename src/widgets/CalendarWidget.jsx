import React, { useState, useEffect } from 'react';
import { GiSundial, GiNotebook } from 'react-icons/gi';

const CalendarWidget = () => {
    const [calendarId, setCalendarId] = useState(localStorage.getItem('me_portal_calendar_id') || '');
    const [isExpanded, setIsExpanded] = useState(false);

    // Listen for updates
    useEffect(() => {
        const handleUpdate = () => {
            setCalendarId(localStorage.getItem('me_portal_calendar_id') || '');
        };
        window.addEventListener('calendar-config-updated', handleUpdate);
        return () => window.removeEventListener('calendar-config-updated', handleUpdate);
    }, []);

    // Helper to construct the dark mode URL
    const getEmbedUrl = (id) => {
        if (!id) return '';
        const base = "https://calendar.google.com/calendar/embed";
        const params = new URLSearchParams({
            src: id,
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
            bgcolor: '#d7cec7',
            color: '#3e2723'
        });
        return `${base}?${params.toString()}`;
    };

    if (!calendarId) {
        return (
            <div className="widget-card" style={{ height: '100%', padding: '1.5rem', background: '#d7cec7', border: '3px double #5d4037', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#5d4037' }}>
                <GiSundial size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <h3>The Chronometer is Disconnected</h3>
                <p>Please enter your <strong>Calendar ID</strong> in Settings to activate the viewing glass.</p>
            </div>
        );
    }

    // Modal Content
    const CalendarFrame = ({ className }) => (
        <iframe
            src={getEmbedUrl(calendarId)}
            style={{ border: 0, width: '100%', height: '100%' }}
            frameBorder="0"
            scrolling="no"
            title="Google Calendar"
            className={className}
        ></iframe>
    );

    return (
        <>
            {/* Standard Widget View */}
            <div className="widget-card" style={{ height: '800px', padding: '1rem', background: '#d7cec7', border: '3px double #5d4037', borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header / Frame */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #795548', paddingBottom: '0.5rem', flexShrink: 0 }}>
                    <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', color: '#3e2723', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <GiSundial /> Google Chronometer
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => setIsExpanded(true)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#5d4037',
                                cursor: 'pointer',
                                fontSize: '1.2rem',
                                padding: '0 4px',
                                display: 'flex', alignItems: 'center'
                            }}
                            title="Expanse Mode (Fullscreen)"
                        >
                            ⤢
                        </button>
                        <a
                            href="https://calendar.google.com/calendar/r/settings/export"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: '#5d4037',
                                textDecoration: 'none',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                border: '1px solid #5d4037',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(255,255,255,0.3)'
                            }}
                            title="Open Google Calendar Import Settings"
                        >
                            <GiNotebook /> Import .ics
                        </a>
                    </div>
                </div>

                {/* The Portal (Iframe) */}
                <div style={{ flex: 1, width: '100%', background: '#fff', borderRadius: '2px', border: '1px solid #795548', position: 'relative' }}>
                    <CalendarFrame />
                </div>

                {/* Note about appearance */}
                <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#8d6e63', marginTop: '0.2rem', flexShrink: 0 }}>
                    * Appearance controlled by Google. For best results, ensure you are logged in.
                </div>
            </div>

            {/* Expanse Mode Modal */}
            {isExpanded && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0,0,0,0.85)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem'
                }}>
                    <div style={{
                        width: '95vw',
                        height: '90vh',
                        background: '#d7cec7',
                        border: '4px double #5d4037',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '1rem',
                        position: 'relative',
                        boxShadow: '0 0 50px rgba(0,0,0,0.8)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #795548', paddingBottom: '0.5rem' }}>
                            <h2 style={{ margin: 0, fontFamily: 'Playfair Display, serif', color: '#3e2723', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <GiSundial /> Chronometer Expanse
                            </h2>
                            <button
                                onClick={() => setIsExpanded(false)}
                                style={{
                                    background: 'var(--accent-crimson)',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontFamily: 'monospace'
                                }}
                            >
                                CLOSE [ESC]
                            </button>
                        </div>
                        <div style={{ flex: 1, background: '#fff', border: '1px solid #795548' }}>
                            <CalendarFrame />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CalendarWidget;
