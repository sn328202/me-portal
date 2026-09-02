import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Bookings — the tables, tastings, shows and slots actually held.
 *
 * It used to be joined to a Spots library by `spot_id`, so eating somewhere
 * could settle the spot in the same action. Spots is gone: a place she wants
 * to go is an idea on the Atlas board now, and an idea is settled by being put
 * on a day, which is a better answer than a status column anybody had to
 * remember to tick. The link and the column went with it.
 */
export const useReservations = () => {
    const { user } = useAuth();
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchReservations = useCallback(async () => {
        if (!user) {
            setReservations([]);
            setLoading(false);
            return;
        }
        try {
            const { data, error: err } = await supabase
                .from('reservations')
                .select('*')
                .eq('user_id', user.id)
                .order('starts_at', { ascending: false });
            if (err) throw err;
            setReservations(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not load your reservations');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchReservations(); }, [fetchReservations]);

    // A booking added from the phone should show up here without a refresh.
    useEffect(() => {
        if (!user) return undefined;
        const channel = supabase
            .channel('reservations-feed')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'reservations', filter: `user_id=eq.${user.id}` },
                (payload) => setReservations((prev) => (
                    prev.some((r) => r.id === payload.new.id) ? prev : [payload.new, ...prev]
                ))
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const addReservation = async (fields) => {
        if (!user) throw new Error('Not authenticated');
        const row = {
            /* `name`, not `restaurant`. The Table Book holds every booking
               now — a tasting, a show, a museum slot — and only the column
               name was still insisting otherwise. The old column and the
               trigger that kept it in step are gone. */
            name: fields.name,
            kind: fields.kind || 'table',
            starts_at: fields.starts_at,
            party_size: fields.party_size ? Number(fields.party_size) : null,
            seating: fields.seating || null,
            city: fields.city || null,
            address: fields.address || null,
            phone: fields.phone || null,
            platform: fields.platform || null,
            confirmation: fields.confirmation || null,
            cancel_by: fields.cancel_by || null,
            cancel_fee: fields.cancel_fee || null,
            notes: fields.notes || null,
            status: fields.status || 'booked',
            source: fields.source || 'manual',
            user_id: user.id,
        };
        const { data, error: err } = await supabase
            .from('reservations').insert([row]).select().single();
        if (err) throw err;
        setReservations((prev) => [data, ...prev]);
        return data;
    };


    const updateReservation = async (id, patch) => {
        if (!user) return;
        setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
        const { error: err } = await supabase
            .from('reservations').update(patch).eq('id', id).eq('user_id', user.id);
        if (err) {
            setError(err.message);
            fetchReservations();   // put the optimistic change back if it did not stick
        }
    };

    /** She ate there. */
    const markDined = (reservation) => updateReservation(reservation.id, { status: 'dined' });

    const cancelReservation = (reservation) =>
        updateReservation(reservation.id, { status: 'cancelled' });

    const deleteReservation = async (id) => {
        if (!user) return;
        setReservations((prev) => prev.filter((r) => r.id !== id));
        await supabase.from('reservations').delete().eq('id', id).eq('user_id', user.id);
    };

    /**
     * A booking in the past that was never settled is still "booked" in the
     * database, but it is history to a reader. Split on the clock, not status.
     */
    const { upcoming, past } = useMemo(() => {
        const now = Date.now();
        const live = reservations.filter((r) => r.status === 'booked');
        return {
            upcoming: live
                .filter((r) => new Date(r.starts_at).getTime() >= now)
                .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)),
            past: reservations
                .filter((r) => r.status !== 'booked' || new Date(r.starts_at).getTime() < now)
                .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)),
        };
    }, [reservations]);

    return {
        reservations, upcoming, past, loading, error,
        addReservation, updateReservation,
        markDined, cancelReservation, deleteReservation,
        refresh: fetchReservations,
    };
};
