import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { setFromForm, songIndex } from '../utils/dances';

/**
 * Dance sets — one tutorial video per group per event. The songs are read
 * out of each set's chapter list; `songs` is that index across all of them.
 */
export const useDanceSets = () => {
    const { user } = useAuth();
    const [sets, setSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSets = useCallback(async () => {
        if (!user) {
            setSets([]);
            setLoading(false);
            return;
        }
        try {
            const { data, error: err } = await supabase
                .from('dance_sets')
                .select('*')
                .eq('user_id', user.id)
                .order('performed_on', { ascending: false, nullsFirst: false });
            if (err) throw err;
            setSets(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not load your dances');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchSets(); }, [fetchSets]);

    const byDate = (a, b) => String(b.performed_on || '').localeCompare(String(a.performed_on || ''));

    /** One set from the form, or several already-shaped rows at once. */
    const addSets = async (forms) => {
        if (!user) throw new Error('Not authenticated');
        const rows = forms.map((f) => ({ ...setFromForm(f), user_id: user.id }));
        const { data, error: err } = await supabase
            .from('dance_sets').insert(rows).select();
        if (err) throw err;
        setSets((prev) => [...(data || []), ...prev].sort(byDate));
        return data;
    };

    const addSet = async (form) => (await addSets([form]))[0];

    const updateSet = async (id, form) => {
        if (!user) return;
        const patch = setFromForm(form);
        setSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)).sort(byDate));
        const { error: err } = await supabase
            .from('dance_sets').update(patch).eq('id', id).eq('user_id', user.id);
        if (err) {
            setError(err.message);
            fetchSets();
        }
    };

    const deleteSet = async (id) => {
        if (!user) return;
        setSets((prev) => prev.filter((s) => s.id !== id));
        const { error: err } = await supabase
            .from('dance_sets').delete().eq('id', id).eq('user_id', user.id);
        if (err) {
            setError(err.message);
            fetchSets();
        }
    };

    const songs = useMemo(() => songIndex(sets), [sets]);

    return {
        sets, songs, loading, error,
        addSet, addSets, updateSet, deleteSet,
        refresh: fetchSets,
    };
};
