import { useSettings } from './useSettings';

export const ALL_WIDGETS = [
    { id: 'greeting', label: 'Traveler Welcome', description: 'Personalized greeting and date' },
    { id: 'status', label: 'Status Console', description: 'System health and performance' },
    { id: 'habits', label: 'Daily Rituals', description: 'Habit tracking and streaks' },
    { id: 'todos', label: 'Active Tasks', description: 'Simple todo list' },
    { id: 'provisions', label: 'Estate Provisions', description: 'Meal plan and grocery list' },
    { id: 'chores', label: 'Estate Upkeep', description: 'Room-by-room chore tracking' },
    { id: 'social', label: 'Social Register', description: 'RSVP and event planning' },
    { id: 'goals', label: 'Life Objectives', description: 'Horizon-based goal tracking' },
    { id: 'hobbies', label: 'Active Pursuits', description: 'Interest and hobby logger' },
    { id: 'travel', label: 'Next Expedition', description: 'Trip countdown and atlas link' },
    { id: 'calendar', label: 'Chronometer', description: 'Embedded Google Calendar' },
    { id: 'library', label: 'Archives Consumed', description: 'Reading stats and book list' },
    { id: 'workouts', label: 'Physical Readiness', description: 'Daily training regimen and 5K tracker' },
    { id: 'links', label: 'Quick Reference', description: 'Essential external links' },
    { id: 'games', label: 'Arcade Terminal', description: 'Quick access to entertainment' }
];

export const useDashboardSettings = () => {
    const { settings, updateSetting, loading } = useSettings();
    const enabledWidgets = settings.enabledWidgets || [];

    const toggleWidget = (id) => {
        const newWidgets = enabledWidgets.includes(id)
            ? enabledWidgets.filter(w => w !== id)
            : [...enabledWidgets, id];

        updateSetting('enabledWidgets', newWidgets);
    };

    const isEnabled = (id) => enabledWidgets.includes(id);

    return { enabledWidgets, toggleWidget, isEnabled, loading };
};
