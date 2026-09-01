import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toBookList } from '../utils/toBook';

/**
 * Everything still to ring up, across every trip and every loose day.
 *
 * One query rather than one per trip: the day and the trip come back nested
 * with the item, because the only thing that makes a row here readable is
 * knowing which day of which trip it belongs to.
 */
export const useToBook = () => {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!user) { setItems([]); setLoading(false); return; }
        try {
            const { data, error: err } = await supabase
                .from('atlas_day_items')
                .select('id, title, start_time, booking, atlas_days!inner(date, city, trip_id, atlas_trips(id, destination))')
                .eq('user_id', user.id)
                .eq('booking', 'todo');
            if (err) throw err;
            setItems(toBookList(data || []));
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not read what is still to book');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    /**
     * Mark one as held, from here.
     *
     * The whole point of a list of phone calls is crossing them off as you
     * make them, and going to find the card each time would defeat it.
     */
    const markBooked = useCallback(async (id) => {
        setItems((list) => list.filter((i) => i.id !== id));
        const { error: err } = await supabase
            .from('atlas_day_items')
            .update({ booking: 'booked', booked: true })
            .eq('id', id);
        if (err) { setError('That would not save — it is still to book.'); load(); }
    }, [load]);

    return { items, loading, error, markBooked, reload: load };
};

export default useToBook;
