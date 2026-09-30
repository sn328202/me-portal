import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { splitByClock, gigFromForm } from '../utils/gigs';

/**
 * Gigs — the concert tickets actually held. A near-twin of `useGigs`.
 */
export const useGigs = () => {
    const { user } = useAuth();
    const [gigs, setGigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchGigs = useCallback(async () => {
        if (!user) {
            setGigs([]);
            setLoading(false);
            return;
        }
        try {
            const { data, error: err } = await supabase
                .from('gigs')
                .select('*')
                .eq('user_id', user.id)
                .order('starts', { ascending: false });
            if (err) throw err;
            setGigs(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not load your gigs');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchGigs(); }, [fetchGigs]);

    // A ticket added from the phone should show up here without a refresh.
    useEffect(() => {
        if (!user) return undefined;
        const channel = supabase
            .channel('gigs-feed')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'gigs', filter: `user_id=eq.${user.id}` },
                (payload) => setGigs((prev) => (
                    prev.some((g) => g.id === payload.new.id) ? prev : [payload.new, ...prev]
                ))
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user]);

    /** Takes the form as it stands; `gigFromForm` is the one mapping. */
    const addGig = async (fields) => {
        if (!user) throw new Error('Not authenticated');
        const row = {
            ...gigFromForm(fields),
            status: fields.status || 'booked',
            source: fields.source || 'manual',
            user_id: user.id,
        };
        const { data, error: err } = await supabase
            .from('gigs').insert([row]).select().single();
        if (err) throw err;
        setGigs((prev) => [data, ...prev]);
        return data;
    };

    const updateGig = async (id, patch) => {
        if (!user) return;
        setGigs((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
        const { error: err } = await supabase
            .from('gigs').update(patch).eq('id', id).eq('user_id', user.id);
        if (err) {
            setError(err.message);
            fetchGigs();   // put the optimistic change back if it did not stick
        }
    };

    /** She went. */
    const markWent = (gig) => updateGig(gig.id, { status: 'went' });
    const cancelGig = (gig) => updateGig(gig.id, { status: 'cancelled' });
    const markSold = (gig) => updateGig(gig.id, { status: 'sold' });

    const deleteGig = async (id) => {
        if (!user) return;
        setGigs((prev) => prev.filter((g) => g.id !== id));
        await supabase.from('gigs').delete().eq('id', id).eq('user_id', user.id);
    };

    const { upcoming, past } = useMemo(() => splitByClock(gigs), [gigs]);

    return {
        gigs, upcoming, past, loading, error,
        addGig, updateGig,
        markWent, markSold, cancelGig, deleteGig,
        refresh: fetchGigs,
    };
};
