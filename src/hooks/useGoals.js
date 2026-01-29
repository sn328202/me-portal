import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useGoals = () => {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchGoals = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('goals')
            .select('*')
            .order('id', { ascending: true });

        if (!error) setGoals(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchGoals();
    }, []);

    const addGoal = async (text, horizon) => {
        if (!text.trim()) return;

        const tempId = Date.now();
        const newGoal = { id: tempId, text, horizon, completed: false };
        setGoals(prev => [...prev, newGoal]);

        const { data, error } = await supabase
            .from('goals')
            .insert([{ text, horizon, completed: false }])
            .select()
            .single();

        if (error) {
            console.error('Error adding goal:', error);
            setGoals(prev => prev.filter(g => g.id !== tempId));
        } else {
            setGoals(prev => prev.map(g => g.id === tempId ? data : g));
        }
    };

    const deleteGoal = async (id) => {
        setGoals(prev => prev.filter(g => g.id !== id));
        await supabase.from('goals').delete().eq('id', id);
    };

    return { goals, addGoal, deleteGoal, loading };
};
