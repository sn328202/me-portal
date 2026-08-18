import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_SETTINGS = {
    vibe: 'dark-academia',
    enabledWidgets: [
        'greeting', 'status', 'habits', 'todos', 'provisions',
        'chores', 'social', 'goals', 'hobbies', 'travel',
        'calendar', 'library', 'links', 'games'
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

    const fetchSettings = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('user_portal_config')
                .select('settings')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;

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
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async (newSettings) => {
        if (!user) return;

        const { error } = await supabase
            .from('user_portal_config')
            .upsert({
                user_id: user.id,
                settings: newSettings,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error saving settings:', error);
        }
    };

    const updateSetting = async (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        await saveSettings(newSettings);
    };

    useEffect(() => {
        fetchSettings();
    }, [user]);

    return { settings, updateSetting, loading, refresh: fetchSettings };
};
