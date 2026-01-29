import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useChores = () => {
    // We fetch flat chores and group them by room in the UI or here
    // Let's keep it flat here for simplicity of CRUD
    const [chores, setChores] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchChores = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('chores')
            .select('*')
            .order('id', { ascending: true });

        if (!error) setChores(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchChores();
    }, []);

    const toggleChore = async (id) => {
        const chore = chores.find(c => c.id === id);
        if (!chore) return;

        const newCompleted = !chore.completed;
        setChores(prev => prev.map(c => c.id === id ? { ...c, completed: newCompleted } : c));

        const { error } = await supabase
            .from('chores')
            .update({ completed: newCompleted })
            .eq('id', id);

        if (error) fetchChores();
    };

    const addChore = async (text, room) => {
        if (!text.trim()) return;

        const tempId = Date.now();
        const newChore = { id: tempId, text, room, completed: false };
        setChores(prev => [...prev, newChore]);

        const { data, error } = await supabase
            .from('chores')
            .insert([{ text, room, completed: false }])
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
        setChores(prev => prev.filter(c => c.id !== id));
        await supabase.from('chores').delete().eq('id', id);
    };

    return { chores, toggleChore, addChore, deleteChore, loading };
};
