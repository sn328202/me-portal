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
    // Secret iCal addresses, one per calendar: { id, name, url, color }.
    // Replaces calendarIcalUrl, which was a single URL and never had a UI.
    calendarFeeds: [],
    calendarIcalUrl: '',
    calendarDarkMode: false,
    statusUrl: '',
    // The Apps Script deployment that writes and reads her Google Sheets. It
    // runs under her own Google account, so this is a URL and a phrase she
    // chose — not a credential of Google's.
    sheetsEndpoint: '',
    sheetsSecret: '',
};
