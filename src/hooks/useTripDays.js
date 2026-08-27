import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { tripCost, lodgingByNight, stayOn } from '../utils/tripCosts';
import { datesBetween } from '../utils/tripDates';

/**
 * A trip's days, the things planned in them, and what it all costs.
 *
 * The days are derived from the trip's own start and end dates rather than
 * created by hand: a trip that runs the 16th to the 31st has sixteen days
 * whether or not anything is planned in them, exactly as the spreadsheet had
 * sixteen columns.
 */

export { datesBetween } from '../utils/tripDates';

export const useTripDays = (trip) => {
    const { user } = useAuth();
    const [days, setDays] = useState([]);
    const [items, setItems] = useState({});
    const [stays, setStays] = useState([]);
    const [loading, setLoading] = useState(false);
    const [weatherState, setWeatherState] = useState({ busy: false, message: null });

    const tripId = trip?.id ?? null;

    const load = useCallback(async () => {
        if (!user || !tripId) { setDays([]); setItems({}); setStays([]); return; }
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

            const { data: stayRows } = await supabase
                .from('atlas_stays').select('*')
                .eq('trip_id', tripId).eq('user_id', user.id).order('check_in');
            setStays(stayRows || []);
        } catch (err) {
            console.error('Error loading trip days:', err);
        } finally {
            setLoading(false);
        }
    }, [user, tripId]);

    useEffect(() => { load(); }, [load]);

    /**
     * Make sure the trip's days match its dates.
     *
     * The first version only ever inserted, on the reasoning that editing the
     * dates should not delete a day with things planned in it. True, but the
     * consequence was worse: every earlier or half-typed end date left its days
     * behind for ever, with no way to remove them. A trip ending 6 January had
     * thirty-six days running to the 27th.
     *
     * So: insert what is missing, and remove what has fallen outside the range
     * *and is empty*. A day with anything in it is kept and flagged instead —
     * it is evidence of a plan, and deleting it silently is the thing the first
     * version was right to avoid.
     */
    const ensureDays = useCallback(async () => {
        if (!user || !trip?.start_date) return;

        const wanted = datesBetween(trip.start_date, trip.end_date);
        // A half-typed date yields no range; do nothing rather than build days
        // for a date nobody meant.
        if (!wanted.length) return;

        const want = new Set(wanted);
        const have = new Set(days.map((d) => String(d.date).slice(0, 10)));

        const missing = wanted.filter((d) => !have.has(d));
        const orphans = days.filter((d) => !want.has(String(d.date).slice(0, 10)));

        const isEmpty = (d) => !d.city && !d.lodging && !d.notes
            && !(items[d.id] || []).length
            && ['lodging', 'food', 'excursions', 'transport', 'points']
                .every((b) => !Number(d[`cost_${b}`]));

        const disposable = orphans.filter(isEmpty).map((d) => d.id);

        if (!missing.length && !disposable.length) return;

        if (missing.length) {
            const { error } = await supabase.from('atlas_days').insert(
                missing.map((date) => ({ trip_id: trip.id, user_id: user.id, date }))
            );
            if (error) console.error('Error creating days:', error);
        }
        if (disposable.length) {
            await supabase.from('atlas_days').delete()
                .in('id', disposable).eq('user_id', user.id);
        }
        await load();
    }, [user, trip, days, items, load]);

    /* ---------- lodging, which spans nights ----------------------------- */

    const addStay = useCallback(async (stay) => {
        if (!user || !tripId) return;
        const { data, error } = await supabase.from('atlas_stays')
            .insert([{ ...stay, trip_id: tripId, user_id: user.id }]).select().single();
        if (error) { console.error('Error adding stay:', error); return; }
        setStays((prev) => [...prev, data].sort((a, b) => a.check_in.localeCompare(b.check_in)));
    }, [user, tripId]);

    const updateStay = useCallback(async (id, patch) => {
        if (!user) return;
        const before = stays.find((s) => s.id === id);
        setStays((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
        const { error } = await supabase
            .from('atlas_stays').update(patch).eq('id', id).eq('user_id', user.id);
        if (error) {
            // The dates carry a check constraint (check_out must be after
            // check_in), so a bad edit is refused rather than stored.
            setStays((prev) => prev.map((s) => (s.id === id ? before : s)));
            console.error('Error updating stay:', error);
        }
    }, [user, stays]);

    const deleteStay = useCallback(async (id) => {
        if (!user) return;
        setStays((prev) => prev.filter((s) => s.id !== id));
        await supabase.from('atlas_stays').delete().eq('id', id).eq('user_id', user.id);
    }, [user]);

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
        () => tripCost(days, items, trip?.party_size || 1, stays),
        [days, items, trip?.party_size, stays]
    );

    /** Days that no longer fall inside the trip but still hold something. */
    const strays = useMemo(() => {
        const want = new Set(datesBetween(trip?.start_date, trip?.end_date));
        if (!want.size) return [];
        return days.filter((d) => !want.has(String(d.date).slice(0, 10)));
    }, [days, trip?.start_date, trip?.end_date]);

    const lodgingPerNight = useMemo(
        () => lodgingByNight(stays, trip?.party_size || 1),
        [stays, trip?.party_size]
    );

    return {
        days, items, stays, strays, loading, costs, lodgingPerNight,
        stayOnDate: (date) => stayOn(stays, date),
        addStay, updateStay, deleteStay,
        weatherBusy: weatherState.busy,
        weatherMessage: weatherState.message,
        ensureDays, updateDay, addItem, updateItem, deleteItem, refreshWeather, reload: load,
    };
};
