/**
 * Default user settings. Lives outside the context module so importing the
 * constant does not drag a component file in with it (and so fast refresh
 * keeps working on the provider).
 */
export const DEFAULT_SETTINGS = {
    vibe: 'dark-academia',
    enabledWidgets: [
        'today', 'greeting', 'status', 'habits', 'todos', 'provisions',
        'chores', 'social', 'goals', 'hobbies', 'travel',
        'calendar', 'library', 'workouts', 'captures', 'links', 'games',
    ],
    // null means "this account predates per-widget tracking" — see
    // hooks/useDashboardSettings.js for how new widgets get switched on.
    knownWidgets: null,
    calendarId: '',
    calendarIcalUrl: '',
    calendarDarkMode: false,
    statusUrl: '',
};
