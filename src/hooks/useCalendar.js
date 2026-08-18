import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { parseICS } from '../utils/icsParser';
import { useSettings } from './useSettings';

export const useCalendar = () => {
    const { user } = useAuth();
    const { settings, updateSetting } = useSettings();
    // Local Manual Events
    const [localEvents, setLocalEvents] = useState([]);
    const [storageKey, setStorageKey] = useState(null);

    // Remote iCal Events
    const [remoteEvents, setRemoteEvents] = useState([]);
    const [loading, setLoading] = useState(false);

    // Initialize User & Keys
    useEffect(() => {
        if (user) {
            const sKey = `me_portal_calendar_${user.id}`;
            setStorageKey(sKey);

            const saved = localStorage.getItem(sKey);
            if (saved) {
                try {
                    setLocalEvents(JSON.parse(saved));
                } catch (e) {
                    console.error("Error parsing local events", e);
                    setLocalEvents([]);
                }
            } else {
                setLocalEvents([]);
            }
        } else {
            setStorageKey(null);
            setLocalEvents([]);
            setRemoteEvents([]);
        }
    }, [user]);

    // Save Local Events to Storage
    useEffect(() => {
        if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(localEvents));
        }
    }, [localEvents, storageKey]);

    // Fetch Remote Calendar
    useEffect(() => {
        const controller = new AbortController();

        const fetchRemote = async () => {
            let url = settings.calendarIcalUrl;
            if (!url) {
                setRemoteEvents([]);
                return;
            }

            if (url.startsWith('webcal://')) url = url.replace('webcal://', 'https://');
            if (!url.startsWith('http')) return;

            setLoading(true);
            try {
                const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
                const res = await fetch(proxyUrl, { signal: controller.signal });
                if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                const text = await res.text();
                const parsed = parseICS(text);
                setRemoteEvents(parsed);
            } catch (err) {
                if (err.name === 'AbortError') {
                    return; // Ignore intentional aborts
                }
                console.error("Failed to fetch calendar", err);
            } finally {
                setLoading(false);
            }
        };

        fetchRemote();

        const handleUpdate = () => {
            fetchRemote();
        };
        window.addEventListener('calendar-config-updated', handleUpdate);

        return () => {
            controller.abort();
            window.removeEventListener('calendar-config-updated', handleUpdate);
        };
    }, [settings.calendarIcalUrl]);

    const addEvent = (date, title, time = '') => {
        if (!storageKey) return;
        const newEvent = {
            id: Date.now(),
            date, // Format: YYYY-MM-DD
            title,
            time
        };
        setLocalEvents(prev => [...prev, newEvent]);
    };

    const deleteEvent = (id) => {
        if (!storageKey) return;
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
