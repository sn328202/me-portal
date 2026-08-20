import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_SETTINGS = {
    vibe: 'dark-academia',
    enabledWidgets: [
        'greeting', 'status', 'habits', 'todos', 'provisions',
        'chores', 'social', 'goals', 'hobbies', 'travel',
        'calendar', 'library', 'workouts', 'captures', 'links', 'games'
    ],
    calendarId: '',
    calendarIcalUrl: '',
    calendarDarkMode: false,
    statusUrl: ''
};

export const useSettings = () => {
    const { user } = useAuth();
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSettings = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('user_portal_config')
                .select('settings')
                .eq('user_id', user.id)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (data?.settings) {
                setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
            } else {
                // Initial Migration from localStorage
                const migrated = {
                    vibe: localStorage.getItem('me_portal_vibe') || DEFAULT_SETTINGS.vibe,
                    enabledWidgets: JSON.parse(localStorage.getItem('me_portal_dashboard_widgets') || JSON.stringify(DEFAULT_SETTINGS.enabledWidgets)),
                    calendarId: localStorage.getItem(`me_portal_calendar_id_${user.id}`) || '',
                    calendarIcalUrl: localStorage.getItem(`me_portal_calendar_url_${user.id}`) || '',
                    calendarDarkMode: localStorage.getItem(`me_portal_calendar_dark_${user.id}`) === 'true',
                    statusUrl: localStorage.getItem('me_portal_status_url') || ''
                };

                setSettings(migrated);
                // Save migrated settings to cloud immediately
                await saveSettings(migrated);
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
            // Surface the failure instead of silently pretending we have defaults
            setError(err.message || 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async (newSettings) => {
        if (!user) return;

        const { error: saveError } = await supabase
            .from('user_portal_config')
            .upsert({
                user_id: user.id,
                settings: newSettings,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (saveError) {
            console.error('Error saving settings:', saveError);
            setError(saveError.message || 'Failed to save settings');
        }
    };

    const updateSetting = async (key, value) => {
        // Build the patch from the latest state so two hook instances
        // can't overwrite each other with a stale snapshot.
        let nextSettings = null;
        setSettings(prev => {
            nextSettings = { ...prev, [key]: value };
            return nextSettings;
        });

        if (nextSettings) {
            await saveSettings(nextSettings);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, [user]);

    return { settings, updateSetting, loading, error, refresh: fetchSettings };
};
