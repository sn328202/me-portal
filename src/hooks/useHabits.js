import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCaptureRevision } from '../contexts/CaptureContext';

// last_completed has historically been stored as `new Date().toDateString()`
// ("Tue Aug 18 2026"). Existing rows use that format, so we keep writing it,
// but comparisons must also accept an ISO `yyyy-MM-dd` value.
const toDayKey = (value) => {
    if (!value) return null;

    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value.toDateString();
    }

    const str = String(value).trim();
    if (!str) return null;

    // ISO date (or ISO timestamp): parse the date part as LOCAL, not UTC
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const [, y, m, d] = isoMatch;
        return new Date(Number(y), Number(m) - 1, Number(d)).toDateString();
    }

    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? str : parsed.toDateString();
};

// True when two stored day values refer to the same calendar day,
// regardless of which of the two formats each one uses.
const isSameDay = (a, b) => {
    const keyA = toDayKey(a);
    const keyB = toDayKey(b);
    return keyA !== null && keyB !== null && keyA === keyB;
};

export const useHabits = () => {
    const { user } = useAuth();
    // Refetch when a quick capture writes to this table.
    const revision = useCaptureRevision();
    const [habits, setHabits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [streak, setStreak] = useState(0);
    const [streakKey, setStreakKey] = useState(null);
    const [updateKey, setUpdateKey] = useState(null);

    const fetchHabits = async () => {
        if (!user) {
            setHabits([]);
            setStreak(0);
            setStreakKey(null);
            setUpdateKey(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Setup Keys
        const sKey = `ritual_streak_${user.id}`;
        const uKey = `last_streak_update_${user.id}`;
        setStreakKey(sKey);
        setUpdateKey(uKey);

        // Load Streak
        const savedStreak = parseInt(localStorage.getItem(sKey) || 0);
        setStreak(savedStreak);

        // Check for broken streak immediately upon load
        const lastUpdate = localStorage.getItem(uKey);
        if (lastUpdate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const today = new Date();

            if (!isSameDay(lastUpdate, today) && !isSameDay(lastUpdate, yesterday)) {
                // Broken streak: clear the stored value too, or the old count
                // comes back on the next load (matches useHobbies).
                setStreak(0);
                localStorage.setItem(sKey, '0');
            }
        }

        const { data, error } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id)
            .order('id', { ascending: true });

        if (!error) {
            // Check for daily reset logic locally after fetch
            const today = new Date();
            const checkData = data || [];
            const checkedData = checkData.map(h => {
                // If last_completed is NOT today, and it IS marked completed, define reset behavior:
                // Actually, if it's a daily habit, we reset it at midnight.
                // Logic: if h.last_completed != today, reset completed to false.
                // Tolerant compare: rows may hold toDateString() or ISO values.
                if (!isSameDay(h.last_completed, today) && h.completed) {
                    return { ...h, completed: false };
                }
                return h;
            });
            setHabits(checkedData);
        } else {
            console.error('Error fetching habits:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchHabits();
    }, [user, revision]);

    // Streak Logic: Increment when all active habits are done
    useEffect(() => {
        if (!streakKey || !updateKey || habits.length === 0) return;

        const activeHabits = habits; // Assuming no 'archived' field for now based on previous code, or if there is, filter it.
        // Previous code had .filter(h => !h.archived) but habits schema might not have it. Assuming all habits are active.
        if (activeHabits.length > 0 && activeHabits.every(h => h.completed)) {
            const lastStreakUpdate = localStorage.getItem(updateKey);
            // Keep writing toDateString() so existing stored values stay valid.
            const today = new Date().toDateString();

            if (!isSameDay(lastStreakUpdate, today)) {
                const newStreak = streak + 1;
                setStreak(newStreak);
                localStorage.setItem(streakKey, newStreak);
                localStorage.setItem(updateKey, today);
            }
        }
    }, [habits, streak, streakKey, updateKey]);

    const toggleHabit = async (id) => {
        if (!user) return;
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
            .eq('id', id)
            .eq('user_id', user.id); // Security

        if (error) {
            console.error('Error updating habit:', error);
            fetchHabits(); // Revert
        }
    };

    const addHabit = async (text) => {
        if (!text.trim() || !user) return;

        const tempId = Date.now();
        const newHabit = { id: tempId, text, completed: false, last_completed: null, user_id: user.id };
        setHabits(prev => [...prev, newHabit]);

        const { data, error } = await supabase
            .from('habits')
            .insert([{ text, completed: false, user_id: user.id }])
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
        if (!user) return;
        setHabits(prev => prev.filter(h => h.id !== id));

        const { error } = await supabase
            .from('habits')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id); // Security

        if (error) {
            console.error('Error deleting habit:', error);
            fetchHabits();
        }
    };

    return { habits, toggleHabit, addHabit, deleteHabit, loading, streak };
};
