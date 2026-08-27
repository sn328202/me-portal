import React, { createContext, useContext, useEffect } from 'react';
import { THEMES, THEME_CHARACTER } from '../configs/themes.jsx';
import { useSettings } from '../hooks/useSettings';

const ThemeContext = createContext();

const CACHE_KEY = 'me_portal_vibe';
const FALLBACK = 'studio';

const applyTheme = (id) => {
    const theme = THEMES[id] || THEMES[FALLBACK];
    const character = THEME_CHARACTER[id] || THEME_CHARACTER[FALLBACK];
    const root = document.documentElement;

    // Character first so a palette can still override a shared value.
    Object.entries({ ...character, ...theme.cssVars }).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });

    document.body.setAttribute('data-theme', theme.id);
};

// Paint the last-known theme before React mounts. Without this, every
// non-default theme flashes Dark Academia for the length of a Supabase
// round trip on each load.
if (typeof document !== 'undefined') {
    try {
        applyTheme(localStorage.getItem(CACHE_KEY) || FALLBACK);
    } catch {
        applyTheme(FALLBACK);
    }
}

export const ThemeProvider = ({ children }) => {
    const { settings, updateSetting, loading } = useSettings();
    const themeId = settings.vibe || FALLBACK;

    const currentTheme = THEMES[themeId] || THEMES[FALLBACK];

    useEffect(() => {
        if (loading) return;
        applyTheme(themeId);
        try {
            localStorage.setItem(CACHE_KEY, themeId);
        } catch {
            /* private mode — the theme still applies, it just won't preload */
        }
    }, [themeId, loading]);

    const getLabel = (key) => currentTheme.labels[key] || key;
    const getIcon = (key) => currentTheme.icons[key] || null;

    const setTheme = (id) => {
        // Apply immediately so the switch feels instant rather than waiting
        // on the settings round trip.
        applyTheme(id);
        try {
            localStorage.setItem(CACHE_KEY, id);
        } catch {
            /* ignore */
        }
        updateSetting('vibe', id);
    };

    return (
        <ThemeContext.Provider value={{
            themeId,
            setTheme,
            currentTheme,
            getLabel,
            getIcon,
            allThemes: Object.values(THEMES),
            loadingSettings: loading
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
