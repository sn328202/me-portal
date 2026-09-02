import { useEffect, useMemo, useRef } from 'react';
import { useSettings } from './useSettings';
import { orderedWidgets, moveWidget, spanOf, nextSpan } from '../utils/dashboardLayout';

/**
 * The widgets there are.
 *
 * Ten ids that used to be here are gone. `habits`, `todos` and `provisions`
 * because the Today card now shows and edits all three lists — provisions
 * brought its meal-plan arithmetic with it rather than being deleted.
 * `links` was a rack of bookmarks, `status` was a setup form for a dashboard
 * that was never embedded, `games` was a link to the crossword. `social` and
 * `goals` had never held a row; `hobbies` and `workouts` had not been touched
 * since February.
 *
 * A saved preference may still name any of them; an id nothing matches is
 * simply not drawn, so an old `enabledWidgets` array needs no migration.
 */
export const ALL_WIDGETS = [
    { id: 'today', label: 'Today', description: 'Rituals, tasks and the whole shopping list — what you typed and what the meal plan needs — in one card' },
    { id: 'tobook', label: 'Still to Book', description: 'Every stop marked "to book", across all trips, in date order' },
    { id: 'greeting', label: 'Traveler Welcome', description: 'Personalized greeting and date' },
    { id: 'chores', label: 'Estate Upkeep', description: 'Room-by-room chore tracking' },
    { id: 'travel', label: 'Next Expedition', description: 'Trip countdown and atlas link' },
    { id: 'calendar', label: 'Chronometer', description: 'Embedded Google Calendar' },
    { id: 'library', label: 'The Stack', description: 'The covers of your favourites, and what you are in the middle of' },
    { id: 'captures', label: 'Dictations', description: 'Thoughts spoken into your phone and where they landed' },
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

    /* Her arrangement. Kept as ids and widths in settings rather than as
       positions, so turning a widget off and on again does not renumber
       everything around it. */
    const spans = useMemo(() => settings.widgetSpans || {}, [settings.widgetSpans]);
    const order = useMemo(
        () => orderedWidgets(ALL_WIDGETS.map((w) => w.id).filter(isEnabled), settings.widgetOrder),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [enabledWidgets, settings.widgetOrder]
    );

    const widthOf = (id) => spanOf(id, spans);

    const widen = (id) => updateSetting('widgetSpans', { ...spans, [id]: nextSpan(widthOf(id)) });

    const rearrange = (activeId, overId) => {
        const next = moveWidget(order, activeId, overId);
        if (next !== order) updateSetting('widgetOrder', next);
        return next;
    };

    return {
        enabledWidgets, toggleWidget, isEnabled, loading,
        order, rearrange, widthOf, widen,
    };
};
