import { useEffect, useMemo, useRef } from 'react';
import { useSettings } from './useSettings';

export const ALL_WIDGETS = [
    { id: 'today', label: 'Today', description: 'Everything with a checkbox — rituals, tasks and the grocery list in one card' },
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
    { id: 'captures', label: 'Dictations', description: 'Thoughts spoken into your phone and where they landed' },
    { id: 'links', label: 'Quick Reference', description: 'Essential external links' },
    { id: 'games', label: 'Arcade Terminal', description: 'Quick access to entertainment' },
];

/**
 * Every widget that existed before `knownWidgets` was introduced. Anything in
 * ALL_WIDGETS but missing from here is genuinely new, so its absence from a
 * saved preference means "did not exist yet", not "she turned it off".
 *
 * Without this distinction a new widget can never appear: an existing account's
 * saved `enabledWidgets` array replaces the default wholesale, so the widget
 * stays invisible forever and looks like a bug in the widget rather than in the
 * preference merge. Do not add new ids to this list.
 */
const LEGACY_WIDGET_IDS = [
    'greeting', 'status', 'habits', 'todos', 'provisions', 'chores', 'social',
    'goals', 'hobbies', 'travel', 'calendar', 'library', 'workouts', 'links', 'games',
];

export const useDashboardSettings = () => {
    const { settings, updateSetting, updateSettings, loading } = useSettings();
    const enabledWidgets = useMemo(() => settings.enabledWidgets || [], [settings.enabledWidgets]);
    const reconciled = useRef(false);

    // Turn on any widget she has never been offered, once, then record that
    // she has now seen every current widget.
    useEffect(() => {
        if (loading || reconciled.current) return;
        const allIds = ALL_WIDGETS.map((w) => w.id);
        const known = settings.knownWidgets || LEGACY_WIDGET_IDS;
        const unseen = allIds.filter((id) => !known.includes(id));

        reconciled.current = true;
        if (!unseen.length && settings.knownWidgets) return;

        updateSettings({
            enabledWidgets: [...new Set([...enabledWidgets, ...unseen])],
            knownWidgets: allIds,
        });
    }, [loading, settings.knownWidgets, enabledWidgets, updateSettings]);

    const toggleWidget = (id) => {
        updateSetting(
            'enabledWidgets',
            enabledWidgets.includes(id)
                ? enabledWidgets.filter((w) => w !== id)
                : [...enabledWidgets, id]
        );
    };

    const isEnabled = (id) => enabledWidgets.includes(id);

    return { enabledWidgets, toggleWidget, isEnabled, loading };
};
