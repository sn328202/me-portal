import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Restaurant reservations — the tables actually held.
 *
 * Spots answers "where do I want to go". This answers "where am I going, and
 * when". They are joined by `spot_id` so a booking made from the library keeps
 * pointing at the place, and eating there can settle the spot in one action
 * instead of two.
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
            restaurant: fields.restaurant,
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
            spot_id: fields.spot_id || null,
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

    /** Book a table at somewhere already in the spots library, keeping the link. */
    const bookSpot = (spot, fields) => addReservation({
        ...fields,
        restaurant: spot.name,
        city: fields.city || spot.city || null,
        address: fields.address || spot.address || null,
        phone: fields.phone || spot.phone || null,
        spot_id: spot.id,
    });

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

    /**
     * She ate there. If the booking came from a saved spot, that spot has now
     * been visited — settling both here means she never has to remember to go
     * back to the library and tick it off.
     */
    const markDined = async (reservation) => {
        await updateReservation(reservation.id, { status: 'dined' });
        if (reservation.spot_id && user) {
            await supabase
                .from('spots')
                .update({ status: 'been', visited_at: reservation.starts_at })
                .eq('id', reservation.spot_id)
                .eq('user_id', user.id);
        }
    };

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
        addReservation, bookSpot, updateReservation,
        markDined, cancelReservation, deleteReservation,
        refresh: fetchReservations,
    };
};
