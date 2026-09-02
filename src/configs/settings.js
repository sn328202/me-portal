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
    // Her dashboard: which order the cards go in, and how many of the three
    // columns each one takes. Both used to be decided in the code.
    widgetOrder: [],
    widgetSpans: {},
    /* The portal's own days in the Chronometer. On by default: they are
       already hers, they cost no request, and a calendar that does not show
       the plan you made in the same app is a strange calendar. */
    portalCalendar: { trips: true },
    calendarIcalUrl: '',
    calendarDarkMode: false,
    statusUrl: '',
};
