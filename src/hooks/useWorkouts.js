import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_WORKOUTS = [
    {
        day_of_week: 'Monday',
        title: 'Speed Intervals (5K builder)',
        details: [
            { text: '5 min warmup walk + jog', completed: false },
            { text: '6 × 3 min at 6.4–6.6 mph', completed: false },
            { text: '1 min walk at 3 mph between', completed: false },
            { text: '5 min cooldown', completed: false },
            { text: 'Progression: Every 2 weeks +1 interval', completed: false }
        ]
    },
    {
        day_of_week: 'Tuesday',
        title: 'Lower Body + Core (Fat Loss)',
        details: [
            { text: 'Romanian deadlifts (DB) – 10 reps', completed: false },
            { text: 'Reverse lunges – 8 each leg', completed: false },
            { text: 'Hip thrusts – 12 reps', completed: false },
            { text: 'Cable woodchoppers – 12 each side', completed: false },
            { text: 'Dead bugs – 10 slow reps', completed: false },
            { text: 'Finish: 10 min incline walk (8-10%, 3.5 mph)', completed: false }
        ]
    },
    {
        day_of_week: 'Wednesday',
        title: 'Zone 2 Easy Run',
        details: [
            { text: 'Run 30–40 min at 5.5–5.8 mph', completed: false },
            { text: 'Pace check: Should be able to talk', completed: false },
            { text: 'Focus: Fat metabolism & recovery', completed: false }
        ]
    },
    {
        day_of_week: 'Thursday',
        title: 'Upper Body + Core (Wrist Friendly)',
        details: [
            { text: 'Lat pulldown – 10 reps', completed: false },
            { text: 'Chest press machine – 10 reps', completed: false },
            { text: 'Seated row – 10 reps', completed: false },
            { text: 'Lateral raises – 12 reps', completed: false },
            { text: 'Plank (forearms) – 30–45 sec', completed: false },
            { text: 'Protection: Neutral grip & machines', completed: false }
        ]
    },
    {
        day_of_week: 'Friday',
        title: 'Tempo Run (Confidence Builder)',
        details: [
            { text: 'Warm up 5 min', completed: false },
            { text: '15–20 min continuous at 6.1–6.3 mph', completed: false },
            { text: 'Progression: Build to 25 min', completed: false }
        ]
    },
    {
        day_of_week: 'Saturday',
        title: 'Active Recovery',
        details: [
            { text: 'Option: Long walk outdoors', completed: false },
            { text: 'Option: Light cycling', completed: false },
            { text: 'Option: Yoga / Mobility', completed: false },
            { text: 'Note: Skip sauna today', completed: false }
        ]
    },
    {
        day_of_week: 'Sunday',
        title: 'Full Rest',
        details: [
            { text: 'No guilt. Your body builds here.', completed: false }
        ]
    }
];

export const useWorkouts = () => {
    const { user } = useAuth();
    const [workouts, setWorkouts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchWorkouts = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('workouts')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;

            if (data.length === 0) {
                // Seed default data
                const seeded = await seedDefaultWorkouts();
                setWorkouts(seeded);
            } else {
                setWorkouts(data);
            }
        } catch (err) {
            console.error('Error fetching workouts:', err);
        } finally {
            setLoading(false);
        }
    };

    const seedDefaultWorkouts = async () => {
        const toInsert = DEFAULT_WORKOUTS.map(w => ({
            ...w,
            user_id: user.id
        }));

        const { data, error } = await supabase
            .from('workouts')
            .insert(toInsert)
            .select();

        if (error) {
            console.error('Error seeding workouts:', error);
            return [];
        }
        return data;
    };

    const updateWorkout = async (id, title, details) => {
        const { error } = await supabase
            .from('workouts')
            .update({ title, details })
            .eq('id', id);

        if (error) {
            console.error('Error updating workout:', error);
        } else {
            setWorkouts(prev => prev.map(w => w.id === id ? { ...w, title, details } : w));
        }
    };

    useEffect(() => {
        fetchWorkouts();
    }, [user]);

    const getTodayWorkout = () => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = days[new Date().getDay()];
        return workouts.find(w => w.day_of_week === today);
    };

    return { workouts, updateWorkout, getTodayWorkout, loading };
};
