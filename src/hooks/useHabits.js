import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useHabits = () => {
    const [habits, setHabits] = useState([]);
    const [loading, setLoading] = useState(true);

    // Calculate Ritual Streak (Simulated for now as we don't have a history table)
    const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('ritual_streak') || 0));

    const fetchHabits = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('habits')
            .select('*')
            .order('id', { ascending: true });

        if (!error) {
            // Check for daily reset logic locally after fetch
            const today = new Date().toDateString();
            const checkedData = data.map(h => {
                if (h.last_completed !== today && h.completed) {
                    return { ...h, completed: false };
                }
                return h;
            });
            setHabits(checkedData);
        }
        setLoading(false);
    };

    // Streak Logic
    useEffect(() => {
        const checkBrokenStreak = () => {
            const lastStreakUpdate = localStorage.getItem('last_streak_update');
            if (lastStreakUpdate) {
                const lastDate = new Date(lastStreakUpdate);
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                // Normalize to date strings
                const lastDateStr = lastDate.toDateString();
                const yesterdayStr = yesterday.toDateString();
                const todayStr = new Date().toDateString();

                // If last update was not today AND not yesterday, streak is broken
                if (lastDateStr !== todayStr && lastDateStr !== yesterdayStr) {
                    setStreak(0);
                    localStorage.setItem('ritual_streak', 0);
                }
            }
        };
        checkBrokenStreak();
    }, []);

    useEffect(() => {
        const activeHabits = habits.filter(h => !h.archived);
        if (activeHabits.length > 0 && activeHabits.every(h => h.completed)) {
            const lastStreakUpdate = localStorage.getItem('last_streak_update');
            const today = new Date().toDateString();
            if (lastStreakUpdate !== today) {
                // If we just verified the streak is valid (or reset it), we can increment
                // But we must check if we are resuming a streak or starting new
                // Actually, if we are here, it means we completed things TODAY.
                // If the streak was broken, it should have been reset to 0 above.
                // So newStreak = streak + 1 is correct.
                // Wait, if I load the page, streaks reset to 0. Then I check the box. streak becomes 1. Correct.
                // If I load page, streak is 10 (from yesterday). I check box. streak becomes 11. Correct.

                const newStreak = streak + 1;
                setStreak(newStreak);
                localStorage.setItem('ritual_streak', newStreak);
                localStorage.setItem('last_streak_update', today);
            }
        }
    }, [habits, streak]);

    useEffect(() => {
        fetchHabits();
    }, []);

    const toggleHabit = async (id) => {
        const habit = habits.find(h => h.id === id);
        if (!habit) return;

        const today = new Date().toDateString();
        const newCompleted = !habit.completed;
        const newLastCompleted = newCompleted ? today : null;

        // Optimistic UI
        setHabits(prev => prev.map(h => h.id === id ? { ...h, completed: newCompleted, last_completed: newLastCompleted } : h));

        const { error } = await supabase
            .from('habits')
            .update({ completed: newCompleted, last_completed: newLastCompleted })
            .eq('id', id);

        if (error) {
            console.error('Error updating habit:', error);
            fetchHabits(); // Revert
        }
    };

    const addHabit = async (text) => {
        const tempId = Date.now();
        const newHabit = { id: tempId, text, completed: false, last_completed: null };
        setHabits(prev => [...prev, newHabit]);

        const { data, error } = await supabase
            .from('habits')
            .insert([{ text, completed: false }])
            .select()
            .single();

        if (error) {
            console.error('Error adding habit:', error);
            setHabits(prev => prev.filter(h => h.id !== tempId));
        } else {
            setHabits(prev => prev.map(h => h.id === tempId ? data : h));
        }
    };

    const deleteHabit = async (id) => {
        setHabits(prev => prev.filter(h => h.id !== id));

        const { error } = await supabase
            .from('habits')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting habit:', error);
            fetchHabits();
        }
    };

    return { habits, toggleHabit, addHabit, deleteHabit, loading, streak };
};
