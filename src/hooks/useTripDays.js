import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { tripCost } from '../utils/tripCosts';

/**
 * A trip's days, the things planned in them, and what it all costs.
 *
 * The days are derived from the trip's own start and end dates rather than
 * created by hand: a trip that runs the 16th to the 31st has sixteen days
 * whether or not anything is planned in them, exactly as the spreadsheet had
 * sixteen columns.
 */

const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Every date from start to end inclusive, as 'YYYY-MM-DD'. */
export const datesBetween = (start, end) => {
    if (!start) return [];
    const from = new Date(`${String(start).slice(0, 10)}T12:00:00`);
    const to = new Date(`${String(end || start).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return [];

    const out = [];
    const cursor = new Date(from);
    // A guard rather than a while(true): a mistyped end date of 2099 should
    // not try to render thirty thousand day cards.
    while (cursor <= to && out.length < 120) {
        out.push(isoDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return out;
};

export const useTripDays = (trip) => {
    const { user } = useAuth();
    const [days, setDays] = useState([]);
    const [items, setItems] = useState({});
    const [loading, setLoading] = useState(false);
    const [weatherState, setWeatherState] = useState({ busy: false, message: null });

    const tripId = trip?.id ?? null;

    const load = useCallback(async () => {
        if (!user || !tripId) { setDays([]); setItems({}); return; }
        setLoading(true);
        try {
            const { data: dayRows, error } = await supabase
                .from('atlas_days').select('*')
                .eq('trip_id', tripId).eq('user_id', user.id).order('date');
            if (error) throw error;

            setDays(dayRows || []);

            const ids = (dayRows || []).map((d) => d.id);
            if (!ids.length) { setItems({}); return; }

            const { data: itemRows } = await supabase
                .from('atlas_day_items').select('*')
                .in('day_id', ids).eq('user_id', user.id)
                .order('sort_order');

            const grouped = {};
            for (const row of itemRows || []) {
                (grouped[row.day_id] ||= []).push(row);
            }
            setItems(grouped);
        } catch (err) {
            console.error('Error loading trip days:', err);
        } finally {
            setLoading(false);
        }
    }, [user, tripId]);

    useEffect(() => { load(); }, [load]);

    /**
     * Make sure a row exists for every date the trip covers.
     *
     * Idempotent, and only ever inserts: a day that has fallen outside the
     * trip's dates (because the dates were edited) keeps its contents rather
     * than being deleted out from under whatever was planned in it.
     */
    const ensureDays = useCallback(async () => {
        if (!user || !trip?.start_date) return;
        const wanted = datesBetween(trip.start_date, trip.end_date);
        const have = new Set(days.map((d) => String(d.date).slice(0, 10)));
        const missing = wanted.filter((d) => !have.has(d));
        if (!missing.length) return;

        const { error } = await supabase.from('atlas_days').insert(
            missing.map((date) => ({ trip_id: trip.id, user_id: user.id, date }))
        );
        if (error) console.error('Error creating days:', error);
        await load();
    }, [user, trip, days, load]);

    const updateDay = useCallback(async (id, patch) => {
        if (!user) return;
        const before = days.find((d) => d.id === id);
        setDays((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
        const { error } = await supabase
            .from('atlas_days').update(patch).eq('id', id).eq('user_id', user.id);
        if (error) {
            setDays((prev) => prev.map((d) => (d.id === id ? before : d)));
            console.error('Error updating day:', error);
        }
    }, [user, days]);

    const addItem = useCallback(async (dayId, item) => {
        if (!user) return;
        const row = {
            day_id: dayId,
            user_id: user.id,
            sort_order: (items[dayId] || []).length,
            ...item,
        };
        const { data, error } = await supabase
            .from('atlas_day_items').insert([row]).select().single();
        if (error) { console.error('Error adding item:', error); return; }
        setItems((prev) => ({ ...prev, [dayId]: [...(prev[dayId] || []), data] }));
    }, [user, items]);

    const updateItem = useCallback(async (dayId, id, patch) => {
        if (!user) return;
        setItems((prev) => ({
            ...prev,
            [dayId]: (prev[dayId] || []).map((i) => (i.id === id ? { ...i, ...patch } : i)),
        }));
        const { error } = await supabase
            .from('atlas_day_items').update(patch).eq('id', id).eq('user_id', user.id);
        if (error) { console.error('Error updating item:', error); load(); }
    }, [user, load]);

    const deleteItem = useCallback(async (dayId, id) => {
        if (!user) return;
        setItems((prev) => ({ ...prev, [dayId]: (prev[dayId] || []).filter((i) => i.id !== id) }));
        await supabase.from('atlas_day_items').delete().eq('id', id).eq('user_id', user.id);
    }, [user]);

    /**
     * Ask the server to fill in the weather.
     *
     * Done server-side because it is several requests per trip and the result
     * is cached onto the day rows - there is no reason to re-fetch ten years
     * of history every time the page opens.
     */
    const refreshWeather = useCallback(async () => {
        if (!tripId) return;
        setWeatherState({ busy: true, message: null });
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;
            const res = await fetch('/api/weather', {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ tripId }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'that did not work');
            await load();
            setWeatherState({
                busy: false,
                message: result.filled
                    ? `Weather filled in for ${result.filled} of ${result.of} days.`
                    : (result.reason || 'No weather available for these dates.'),
            });
        } catch (err) {
            setWeatherState({ busy: false, message: err.message });
        }
    }, [tripId, load]);

    const costs = useMemo(
        () => tripCost(days, items, trip?.party_size || 1),
        [days, items, trip?.party_size]
    );

    return {
        days, items, loading, costs,
        weatherBusy: weatherState.busy,
        weatherMessage: weatherState.message,
        ensureDays, updateDay, addItem, updateItem, deleteItem, refreshWeather, reload: load,
    };
};
