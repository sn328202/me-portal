import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Every hotel booking, with or without a trip. A trip's own stays are still
 * loaded and edited by `useTripDays`; this is the Bookings room's view of all
 * of them, including the ones still waiting for a trip to cover their dates.
 */
export const useStays = () => {
    const { user } = useAuth();
    const [stays, setStays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStays = useCallback(async () => {
        if (!user) {
            setStays([]);
            setLoading(false);
            return;
        }
        try {
            const { data, error: err } = await supabase
                .from('atlas_stays')
                .select('*, atlas_trips(id, destination)')
                .eq('user_id', user.id)
                .order('check_in', { ascending: true });
            if (err) throw err;
            setStays(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not load your hotels');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchStays(); }, [fetchStays]);

    const addStay = async (fields) => {
        if (!user) throw new Error('Not authenticated');
        const { data, error: err } = await supabase.from('atlas_stays')
            .insert([{ ...fields, trip_id: fields.trip_id ?? null, user_id: user.id }])
            .select('*, atlas_trips(id, destination)').single();
        if (err) throw err;
        setStays((prev) => [...prev, data].sort((a, b) => a.check_in.localeCompare(b.check_in)));
        return data;
    };

    const deleteStay = async (id) => {
        if (!user) return;
        setStays((prev) => prev.filter((s) => s.id !== id));
        await supabase.from('atlas_stays').delete().eq('id', id).eq('user_id', user.id);
    };

    return { stays, loading, error, addStay, deleteStay, refresh: fetchStays };
};
