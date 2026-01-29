import { useState, useEffect } from 'react';
import { parseICS } from '../utils/icsParser';

export const useCalendar = () => {
    // Local Manual Events
    const [localEvents, setLocalEvents] = useState(() => {
        const saved = localStorage.getItem('me_portal_calendar');
        return saved ? JSON.parse(saved) : [];
    });

    // Remote iCal Events
    const [remoteEvents, setRemoteEvents] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        localStorage.setItem('me_portal_calendar', JSON.stringify(localEvents));
    }, [localEvents]);

    // Fetch Remote Calendar
    useEffect(() => {
        const fetchRemote = async () => {
            let url = localStorage.getItem('me_portal_calendar_url');
            if (!url) return;

            if (url.startsWith('webcal://')) url = url.replace('webcal://', 'https://');
            if (!url.startsWith('http')) return;

            setLoading(true);
            try {
                const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                const text = await res.text();
                const parsed = parseICS(text);
                setRemoteEvents(parsed);
            } catch (err) {
                console.error("Failed to fetch calendar", err);
            } finally {
                setLoading(false);
            }
        };

        // Initial Fetch
        fetchRemote();

        // Listen for updates from Settings page
        const handleUpdate = () => fetchRemote();
        window.addEventListener('calendar-config-updated', handleUpdate);

        return () => window.removeEventListener('calendar-config-updated', handleUpdate);
    }, []);

    const addEvent = (date, title, time = '') => {
        const newEvent = {
            id: Date.now(),
            date, // Format: YYYY-MM-DD
            title,
            time
        };
        setLocalEvents(prev => [...prev, newEvent]);
    };

    const deleteEvent = (id) => {
        setLocalEvents(prev => prev.filter(e => e.id !== id));
    };

    // Combine Local + Remote
    const allEvents = [...localEvents, ...remoteEvents];

    const getEventsForDate = (date) => {
        return allEvents.filter(e => e.date === date).sort((a, b) => {
            // Sort by time if available, otherwise alpha
            const timeA = a.time || '';
            const timeB = b.time || '';
            return timeA.localeCompare(timeB);
        });
    };

    return { events: allEvents, addEvent, deleteEvent, getEventsForDate, loading };
};
