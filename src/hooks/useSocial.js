import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useSocial = () => {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchEvents = async () => {
        if (!user) {
            setEvents([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data, error } = await supabase
            .from('social_plans')
            .select('*')
            .eq('user_id', user.id)
            .order('when_date', { ascending: true }); // Sort by date

        if (!error) setEvents(data || []);
        else console.error('Error fetching social plans:', error);
        setLoading(false);
    };

    useEffect(() => {
        fetchEvents();
    }, [user]);

    const addEvent = async (event) => {
        if (!user) return;

        // Optimistic
        const tempId = Date.now();
        // Careful with date property: passed as 'when' or 'when_date'? Old code line 45 used `event.when` mapping to `when_date`.
        const newEvent = { ...event, id: tempId, user_id: user.id, when_date: event.when };
        setEvents(prev => [...prev, newEvent].sort((a, b) => new Date(a.when_date) - new Date(b.when_date)));

        const { data, error } = await supabase
            .from('social_plans')
            .insert([{
                who: event.who,
                what: event.what,
                when_date: event.when,
                where_loc: event.where,
                user_id: user.id
            }])
            .select()
            .single();

        if (error) {
            console.error('Error adding social event:', error);
            setEvents(prev => prev.filter(e => e.id !== tempId));
        } else {
            setEvents(prev => prev.map(e => e.id === tempId ? data : e));
        }
    };

    const deleteEvent = async (id) => {
        if (!user) return;
        setEvents(prev => prev.filter(e => e.id !== id));
        await supabase.from('social_plans').delete().eq('id', id).eq('user_id', user.id);
    };

    return { events, addEvent, deleteEvent, loading };
};
