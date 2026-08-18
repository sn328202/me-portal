import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useChores = () => {
    // We fetch flat chores and group them by room in the UI or here
    // Let's keep it flat here for simplicity of CRUD
    const { user } = useAuth();
    const [chores, setChores] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchChores = async () => {
        if (!user) {
            setChores([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data, error } = await supabase
            .from('chores')
            .select('*')
            .eq('user_id', user.id)
            .order('id', { ascending: true });

        if (!error) setChores(data || []);
        else console.error('Error fetching chores:', error);
        setLoading(false);
    };

    useEffect(() => {
        fetchChores();
    }, [user]);

    const toggleChore = async (id) => {
        if (!user) return;
        const chore = chores.find(c => c.id === id);
        if (!chore) return;

        const newCompleted = !chore.completed;
        setChores(prev => prev.map(c => c.id === id ? { ...c, completed: newCompleted } : c));

        const { error } = await supabase
            .from('chores')
            .update({ completed: newCompleted })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error updating chore:', error);
            fetchChores();
        }
    };

    const addChore = async (text, room) => {
        if (!text.trim() || !user) return;

        const tempId = Date.now();
        const newChore = { id: tempId, text, room, completed: false, user_id: user.id };
        setChores(prev => [...prev, newChore]);

        const { data, error } = await supabase
            .from('chores')
            .insert([{ text, room, completed: false, user_id: user.id }])
            .select()
            .single();

        if (error) {
            console.error('Error adding chore:', error);
            setChores(prev => prev.filter(c => c.id !== tempId));
        } else {
            setChores(prev => prev.map(c => c.id === tempId ? data : c));
        }
    };

    const deleteChore = async (id) => {
        if (!user) return;
        setChores(prev => prev.filter(c => c.id !== id));
        await supabase.from('chores').delete().eq('id', id).eq('user_id', user.id);
    };

    return { chores, toggleChore, addChore, deleteChore, loading };
};
