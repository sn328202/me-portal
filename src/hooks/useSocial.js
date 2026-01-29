import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useSocial = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchEvents = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('social_plans')
            .select('*')
            .order('when_date', { ascending: true }); // Sort by date

        if (!error) setEvents(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const addEvent = async (event) => {
        // Optimistic
        const tempId = Date.now();
        const newEvent = { ...event, id: tempId };
        setEvents(prev => [...prev, newEvent].sort((a, b) => new Date(a.when_date) - new Date(b.when_date)));

        const { data, error } = await supabase
            .from('social_plans')
            .insert([{
                who: event.who,
                what: event.what,
                when_date: event.when,
                where_loc: event.where
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
        setEvents(prev => prev.filter(e => e.id !== id));
        await supabase.from('social_plans').delete().eq('id', id);
    };

    return { events, addEvent, deleteEvent, loading };
};
