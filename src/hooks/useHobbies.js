import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useHobbies = () => {
    const [hobbies, setHobbies] = useState([]);
    const [loading, setLoading] = useState(true);

    // Calculate Active Pursuit Streak
    const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('pursuit_streak') || 0));

    useEffect(() => {
        const checkBrokenStreak = () => {
            const lastStreakUpdate = localStorage.getItem('last_pursuit_update');
            if (lastStreakUpdate) {
                const lastDate = new Date(lastStreakUpdate);
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                const lastDateStr = lastDate.toDateString();
                const yesterdayStr = yesterday.toDateString();
                const todayStr = new Date().toDateString();

                if (lastDateStr !== todayStr && lastDateStr !== yesterdayStr) {
                    setStreak(0);
                    localStorage.setItem('pursuit_streak', '0');
                }
            }
        };
        checkBrokenStreak();
    }, []);

    const fetchHobbies = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('hobbies')
            .select('*')
            .order('name', { ascending: true });

        if (!error) setHobbies(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchHobbies();
    }, []);

    const addHobby = async (name) => {
        if (!name.trim()) return;

        const tempId = Date.now();
        const newHobby = { id: tempId, name, status: 'Active' };
        setHobbies(prev => [...prev, newHobby]);

        const { data, error } = await supabase
            .from('hobbies')
            .insert([{ name, status: 'Active' }])
            .select()
            .single();

        if (error) {
            console.error('Error adding hobby:', error);
            setHobbies(prev => prev.filter(h => h.id !== tempId));
        } else {
            setHobbies(prev => prev.map(h => h.id === tempId ? data : h));
        }
    };

    const toggleStatus = async (id) => {
        const hobby = hobbies.find(h => h.id === id);
        if (!hobby) return;

        const newStatus = hobby.status === 'Active' ? 'On Hold' : 'Active';
        setHobbies(prev => prev.map(h => h.id === id ? { ...h, status: newStatus } : h));

        const { error } = await supabase
            .from('hobbies')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) fetchHobbies();
    };

    const deleteHobby = async (id) => {
        setHobbies(prev => prev.filter(h => h.id !== id));
        await supabase.from('hobbies').delete().eq('id', id);
    };

    const logSession = async (id) => {
        const now = new Date().toISOString();
        // Optimistic Update
        setHobbies(prev => prev.map(h => {
            if (h.id === id) {
                return { ...h, last_session: now };
            }
            return h;
        }));

        // Streak Update Logic
        const lastStreakUpdate = localStorage.getItem('last_pursuit_update');
        const today = new Date().toDateString();

        if (lastStreakUpdate !== today) {
            const lastDate = lastStreakUpdate ? new Date(lastStreakUpdate) : null;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            let newStreak = 1; // Default to 1

            // If last update was yesterday, continue streak
            if (lastDate && lastDate.toDateString() === yesterday.toDateString()) {
                newStreak = streak + 1;
            } else if (streak > 0 && lastDate && lastDate.toDateString() === today) {
                newStreak = streak;
            }

            setStreak(newStreak);
            localStorage.setItem('pursuit_streak', newStreak.toString());
            localStorage.setItem('last_pursuit_update', today);
        }
        const { error } = await supabase
            .from('hobbies')
            .update({ last_session: now })
            .eq('id', id);

        if (error) fetchHobbies();
    };

    return { hobbies, addHobby, toggleStatus, deleteHobby, logSession, loading, streak };
};
