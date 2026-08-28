import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSettings } from './useSettings';

/**
 * Calendar feeds and their events.
 *
 * Replaces an unused hook that fetched an iCal URL through api.codetabs.com,
 * a public third-party proxy. Nothing consumed it, so nothing leaked — but a
 * calendar's *secret address* is exactly the kind of thing that must never be
 * handed to a stranger's server, and this feature is built around that address.
 * Everything now goes through /api/calendar, which fetches and parses on our
 * own server and returns plain events.
 */

const FEED_COLORS = [
    'var(--text-gold)',
    'var(--accent-crimson)',
    'var(--fill-quiet)',
    'var(--border-gold)',
];

const post = async (body) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('You are signed out — sign in again.');

    const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The calendar could not be read.');
    return data;
};

export const useCalendar = () => {
    const { settings, updateSetting } = useSettings();
    const [events, setEvents] = useState([]);
    const [feeds, setFeeds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const saved = settings.calendarFeeds;

    const refresh = useCallback(async () => {
        if (!Array.isArray(saved) || saved.length === 0) {
            setEvents([]);
            setFeeds([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            /* Her zone travels with the request: the portal's own days are
               wall-clock times with no zone, and the API runs in UTC. */
            const data = await post({ zone: Intl.DateTimeFormat().resolvedOptions().timeZone });
            setEvents(data.events || []);
            setFeeds(data.feeds || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [saved]);

    // Refetch when the set of feeds changes, not on every settings write.
    useEffect(() => { refresh(); }, [refresh]);

    /** Check an address before committing to it, so a typo is caught at entry. */
    const probe = useCallback(async (url) => {
        try {
            return await post({ probe: url });
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }, []);

    const addFeed = useCallback(async ({ name, url }) => {
        const list = Array.isArray(saved) ? saved : [];
        const feed = {
            // Enough to key one person's list; not an identifier anything
            // else depends on.
            id: `feed-${Date.now()}`,
            name: (name || '').trim() || 'Calendar',
            url: (url || '').trim(),
            color: FEED_COLORS[list.length % FEED_COLORS.length],
        };
        await updateSetting('calendarFeeds', [...list, feed]);
        return feed;
    }, [saved, updateSetting]);

    const removeFeed = useCallback(async (id) => {
        const list = Array.isArray(saved) ? saved : [];
        await updateSetting('calendarFeeds', list.filter((f) => f.id !== id));
    }, [saved, updateSetting]);

    return {
        events,
        feeds,
        savedFeeds: Array.isArray(saved) ? saved : [],
        loading,
        error,
        refresh,
        probe,
        addFeed,
        removeFeed,
    };
};
