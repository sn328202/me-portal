import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { DEFAULT_SETTINGS } from '../configs/settings';

/**
 * One source of truth for user settings.
 *
 * This used to be a plain hook, which meant every component that called it got
 * its own independent copy of the settings object — eight of them at last
 * count, two of them on the Settings page alone. Each copy fetched separately
 * and, on save, wrote its *whole* snapshot back. So toggling a dashboard widget
 * in one copy and then changing the theme in another wrote the theme copy's
 * stale `enabledWidgets` straight over the toggle. The preference really was
 * saved; the next unrelated save reverted it.
 *
 * A provider fixes that structurally: one fetch, one state, one writer.
 */


const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // The authoritative copy for writes. State alone is not safe to read
    // immediately after setState — React may not have applied it yet, and under
    // StrictMode the updater runs twice. Reading the freshest value from a ref
    // is what makes a save reflect the change that triggered it.
    const ref = useRef(DEFAULT_SETTINGS);
    // Saves are chained rather than fired in parallel, so two quick toggles
    // cannot race and land out of order.
    const queue = useRef(Promise.resolve());

    const apply = useCallback((next) => {
        ref.current = next;
        setSettings(next);
        return next;
    }, []);

    const persist = useCallback(async (next) => {
        if (!user) return;
        const { error: saveError } = await supabase
            .from('user_portal_config')
            .upsert(
                { user_id: user.id, settings: next, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
            );
        if (saveError) {
            console.error('Error saving settings:', saveError);
            setError(saveError.message || 'Could not save your settings');
        } else {
            setError(null);
        }
    }, [user]);

    const fetchSettings = useCallback(async () => {
        if (!user) {
            apply(DEFAULT_SETTINGS);
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
                apply({ ...DEFAULT_SETTINGS, ...data.settings });
            } else {
                // First run on this account: lift anything the old
                // localStorage-only version left behind.
                const readJson = (key, fallback) => {
                    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
                };
                const migrated = {
                    ...DEFAULT_SETTINGS,
                    vibe: localStorage.getItem('me_portal_vibe') || DEFAULT_SETTINGS.vibe,
                    enabledWidgets: readJson('me_portal_dashboard_widgets', DEFAULT_SETTINGS.enabledWidgets),
                    calendarId: localStorage.getItem(`me_portal_calendar_id_${user.id}`) || '',
                    calendarIcalUrl: localStorage.getItem(`me_portal_calendar_url_${user.id}`) || '',
                    calendarDarkMode: localStorage.getItem(`me_portal_calendar_dark_${user.id}`) === 'true',
                    statusUrl: localStorage.getItem('me_portal_status_url') || '',
                };
                apply(migrated);
                await persist(migrated);
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
            setError(err.message || 'Could not load your settings');
        } finally {
            setLoading(false);
        }
    }, [user, apply, persist]);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    /** Update one key. Always writes the whole latest object, never a snapshot. */
    const updateSetting = useCallback((key, value) => {
        const next = apply({ ...ref.current, [key]: value });
        queue.current = queue.current.then(() => persist(next)).catch(() => {});
        return queue.current;
    }, [apply, persist]);

    /** Update several keys at once — one write instead of several. */
    const updateSettings = useCallback((patch) => {
        const next = apply({ ...ref.current, ...patch });
        queue.current = queue.current.then(() => persist(next)).catch(() => {});
        return queue.current;
    }, [apply, persist]);

    const value = { settings, updateSetting, updateSettings, loading, error, refresh: fetchSettings };
    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
    return ctx;
};
