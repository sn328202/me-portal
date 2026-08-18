import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useHobbies = () => {
    const { user } = useAuth();
    const [hobbies, setHobbies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [streak, setStreak] = useState(0);

    const fetchHobbies = async () => {
        if (!user) {
            setHobbies([]);
            setStreak(0);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Streak Logic with User isolation
        const sKey = `pursuit_streak_${user.id}`;
        const uKey = `last_pursuit_update_${user.id}`;

        const savedStreak = parseInt(localStorage.getItem(sKey) || 0);
        setStreak(savedStreak);

        const lastStreakUpdate = localStorage.getItem(uKey);
        if (lastStreakUpdate) {
            const lastDate = new Date(lastStreakUpdate);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const lastDateStr = lastDate.toDateString();
            const yesterdayStr = yesterday.toDateString();
            const todayStr = new Date().toDateString();

            if (lastDateStr !== todayStr && lastDateStr !== yesterdayStr) {
                // Broken streak
                setStreak(0);
                localStorage.setItem(sKey, '0');
            }
        }

        const { data, error } = await supabase
            .from('hobbies')
            .select('*')
            .eq('user_id', user.id)
            .order('name', { ascending: true });

        if (!error) setHobbies(data || []);
        else console.error('Error fetching hobbies:', error);
        setLoading(false);
    };

    useEffect(() => {
        fetchHobbies();
    }, [user]);

    const addHobby = async (name) => {
        if (!name.trim() || !user) return;

        const tempId = Date.now();
        const newHobby = { id: tempId, name, status: 'Active', user_id: user.id };
        setHobbies(prev => [...prev, newHobby]);

        const { data, error } = await supabase
            .from('hobbies')
            .insert([{ name, status: 'Active', user_id: user.id }])
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
        if (!user) return;
        const hobby = hobbies.find(h => h.id === id);
        if (!hobby) return;

        const newStatus = hobby.status === 'Active' ? 'On Hold' : 'Active';
        setHobbies(prev => prev.map(h => h.id === id ? { ...h, status: newStatus } : h));

        const { error } = await supabase
            .from('hobbies')
            .update({ status: newStatus })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) fetchHobbies();
    };

    const deleteHobby = async (id) => {
        if (!user) return;
        setHobbies(prev => prev.filter(h => h.id !== id));
        await supabase.from('hobbies').delete().eq('id', id).eq('user_id', user.id);
    };

    const logSession = async (id) => {
        if (!user) return;
        const now = new Date().toISOString();
        // Optimistic Update
        setHobbies(prev => prev.map(h => {
            if (h.id === id) {
                return { ...h, last_session: now };
            }
            return h;
        }));

        // Streak Update Logic
        const sKey = `pursuit_streak_${user.id}`;
        const uKey = `last_pursuit_update_${user.id}`;

        const lastStreakUpdate = localStorage.getItem(uKey);
        const today = new Date().toDateString();

        if (lastStreakUpdate !== today) {
            const lastDate = lastStreakUpdate ? new Date(lastStreakUpdate) : null;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            let newStreak = 1; // Default to 1 if no streak or broken

            // If last update was yesterday, continue streak
            if (lastDate && lastDate.toDateString() === yesterday.toDateString()) {
                newStreak = streak + 1;
            } else if (streak > 0 && lastDate && lastDate.toDateString() === today) {
                newStreak = streak; // Already updated today
            }

            setStreak(newStreak);
            localStorage.setItem(sKey, newStreak.toString());
            localStorage.setItem(uKey, today);
        }

        const { error } = await supabase
            .from('hobbies')
            .update({ last_session: now })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) fetchHobbies();
    };

    return { hobbies, addHobby, toggleStatus, deleteHobby, logSession, loading, streak };
};
