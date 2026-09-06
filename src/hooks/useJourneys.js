import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { splitByClock } from '../utils/journeys';

/**
 * Journeys — the flights, trains, ferries and coaches actually held.
 *
 * A near-twin of `useReservations`, and deliberately not a generalisation of
 * it. The two tables have different columns, different orderings and different
 * words for what "done" means (a table is *dined*, a journey is *travelled*),
 * and a shared hook parameterised over all three would be harder to read than
 * both of these put together.
 */
export const useJourneys = () => {
    const { user } = useAuth();
    const [journeys, setJourneys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchJourneys = useCallback(async () => {
        if (!user) {
            setJourneys([]);
            setLoading(false);
            return;
        }
        try {
            const { data, error: err } = await supabase
                .from('journeys')
                .select('*')
                .eq('user_id', user.id)
                .order('departs', { ascending: false });
            if (err) throw err;
            setJourneys(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not load your journeys');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchJourneys(); }, [fetchJourneys]);

    // A ticket added from the phone should show up here without a refresh.
    useEffect(() => {
        if (!user) return undefined;
        const channel = supabase
            .channel('journeys-feed')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'journeys', filter: `user_id=eq.${user.id}` },
                (payload) => setJourneys((prev) => (
                    prev.some((j) => j.id === payload.new.id) ? prev : [payload.new, ...prev]
                ))
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const addJourney = async (fields) => {
        if (!user) throw new Error('Not authenticated');
        const row = {
            mode: fields.mode || 'flight',
            carrier: fields.carrier || null,
            number: fields.number || null,
            from_place: fields.from_place || null,
            to_place: fields.to_place || null,
            /* Wall clocks, exactly as printed on the ticket — no `Z`, no
               offset, nothing that would let Postgres or the browser decide
               which zone they belong to. See utils/journeys for why. */
            departs: fields.departs,
            arrives: fields.arrives || null,
            duration: fields.duration || null,
            confirmation: fields.confirmation || null,
            /* An empty cost box is "she did not say", not zero. A free flight
               and an unrecorded one are different facts and the ledger should
               not be told they are the same. */
            cost: fields.cost === '' || fields.cost === null || fields.cost === undefined
                ? null : Number(fields.cost),
            currency: fields.currency || null,
            baggage: fields.baggage || null,
            notes: fields.notes || null,
            status: fields.status || 'booked',
            source: fields.source || 'manual',
            user_id: user.id,
        };
        const { data, error: err } = await supabase
            .from('journeys').insert([row]).select().single();
        if (err) throw err;
        setJourneys((prev) => [data, ...prev]);
        return data;
    };

    const updateJourney = async (id, patch) => {
        if (!user) return;
        setJourneys((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
        const { error: err } = await supabase
            .from('journeys').update(patch).eq('id', id).eq('user_id', user.id);
        if (err) {
            setError(err.message);
            fetchJourneys();   // put the optimistic change back if it did not stick
        }
    };

    /** She took it. */
    const markTravelled = (journey) => updateJourney(journey.id, { status: 'travelled' });
    const cancelJourney = (journey) => updateJourney(journey.id, { status: 'cancelled' });

    const deleteJourney = async (id) => {
        if (!user) return;
        setJourneys((prev) => prev.filter((j) => j.id !== id));
        await supabase.from('journeys').delete().eq('id', id).eq('user_id', user.id);
    };

    const { upcoming, past } = useMemo(() => splitByClock(journeys), [journeys]);

    return {
        journeys, upcoming, past, loading, error,
        addJourney, updateJourney,
        markTravelled, cancelJourney, deleteJourney,
        refresh: fetchJourneys,
    };
};
