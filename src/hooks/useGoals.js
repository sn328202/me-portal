import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useGoals = () => {
    const { user } = useAuth();
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchGoals = async () => {
        if (!user) {
            setGoals([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data, error } = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', user.id)
            .order('id', { ascending: true });

        if (!error) setGoals(data || []);
        else console.error('Error fetching goals:', error);
        setLoading(false);
    };

    useEffect(() => {
        fetchGoals();
    }, [user]);

    const addGoal = async (text, horizon) => {
        if (!text.trim() || !user) return;

        const tempId = Date.now();
        const newGoal = { id: tempId, text, horizon, completed: false, user_id: user.id };
        setGoals(prev => [...prev, newGoal]);

        const { data, error } = await supabase
            .from('goals')
            .insert([{ text, horizon, completed: false, user_id: user.id }])
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
        if (!user) return;
        setGoals(prev => prev.filter(g => g.id !== id));
        await supabase.from('goals').delete().eq('id', id).eq('user_id', user.id);
    };

    return { goals, addGoal, deleteGoal, loading };
};
