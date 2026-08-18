import React, { createContext, useContext, useEffect } from 'react';
import { THEMES } from '../configs/themes.jsx';
import { useSettings } from '../hooks/useSettings';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const { settings, updateSetting, loading } = useSettings();
    const themeId = settings.vibe || 'dark-academia';

    const currentTheme = THEMES[themeId] || THEMES['dark-academia'];

    useEffect(() => {
        if (loading) return;

        // Apply CSS variables to root
        const root = document.documentElement;
        const vars = currentTheme.cssVars;

        Object.entries(vars).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        // Apply theme-id to body for specific CSS overrides
        document.body.setAttribute('data-theme', themeId);
    }, [themeId, currentTheme, loading]);

    const getLabel = (key) => currentTheme.labels[key] || key;
    const getIcon = (key) => currentTheme.icons[key] || null;

    const setTheme = (id) => {
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
