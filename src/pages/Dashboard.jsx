import React from 'react';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { GiMove, GiCheckMark } from 'react-icons/gi';
import GreetingWidget from '../widgets/GreetingWidget';
import { useAuth } from '../contexts/AuthContext';
import LibraryStats from '../widgets/LibraryStats';
import CalendarWidget from '../widgets/CalendarWidget';
import ChoresWidget from '../widgets/ChoresWidget';
import TravelWidget from '../widgets/TravelWidget';
import TodayWidget from '../widgets/TodayWidget';
import ToBookWidget from '../widgets/ToBookWidget';
import CapturesWidget from '../widgets/CapturesWidget';
import { useRecipes } from '../hooks/useRecipes';
import { useHabits } from '../hooks/useHabits';
import { useDashboardSettings } from '../hooks/useDashboardSettings';
import { useTheme } from '../contexts/ThemeContext';
import StreakBadge from '../components/gamification/StreakBadge';
import WelcomeHero from '../components/WelcomeHero';
import DashSlot from '../components/DashSlot';
import Button from '../components/ui/Button';
import '../styles/Dashboard.css';

/* One place that says which id draws what, so the order can be a list of ids
   and nothing else. */
const WIDGETS = {
    today: ({ mealPlan, recipes }) => <TodayWidget plan={mealPlan} recipes={recipes} />,
    tobook: () => <ToBookWidget />,
    captures: () => <CapturesWidget />,
    chores: () => <ChoresWidget />,
    travel: () => <TravelWidget />,
    calendar: () => <CalendarWidget />,
    library: () => <LibraryStats />,
};

/* What to call each one while she is moving it, since in arrange mode the
   card underneath is covered. */
const NAMES = {
    today: 'Today',
    tobook: 'Still to book',
    captures: 'Dictations',
    chores: 'Upkeep',
    travel: 'Next expedition',
    calendar: 'Chronometer',
    library: 'The Stack',
};

const Dashboard = () => {
    const { user } = useAuth();
    const { mealPlan, recipes, loading: recipesLoading } = useRecipes();
    const { habits, streak: ritualStreak, loading: habitsLoading } = useHabits();
    const { isEnabled, order, rearrange, widthOf, widen } = useDashboardSettings();
    const [arranging, setArranging] = React.useState(false);

    /* A little travel before a press becomes a drag, so a slip of the hand on
       a trackpad does not reorder the page. */
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const { getLabel, getIcon } = useTheme();

    // Onboarding Persistence
    const [showWelcome, setShowWelcome] = React.useState(() => {
        return !localStorage.getItem(`welcome_dismissed_${user?.id}`);
    });

    const dismissWelcome = () => {
        setShowWelcome(false);
        localStorage.setItem(`welcome_dismissed_${user?.id}`, 'true');
    };

    // Determine if user is "new" (no habits, no recipes, etc.)
    // Only meaningful once the underlying data has actually loaded.
    const dataLoaded = !habitsLoading && !recipesLoading;
    const isNewUser = dataLoaded && recipes.length === 0 && habits.length === 0;

    return (
        <div className="dashboard-grid">
            {showWelcome && isNewUser && <WelcomeHero onDismiss={dismissWelcome} />}

            {/* The entrance hall: a greeting and a mantelpiece, nothing else.
                The Status Console used to sit between them at 600px tall and
                flatten both. */}
            <div className="dashboard-header-row">
                {isEnabled('greeting') && (
                    <div className="greeting-container">
                        <GreetingWidget />
                    </div>
                )}

                {/* One badge. The theme's labels already read as names —
                    "The Streak" — so appending the word produced "THE STREAK
                    STREAK" here; a badge is a number under a name and does not
                    need to say what kind of number. The Pastimes badge went
                    with its widget: it had read zero since February. */}
                <div className="trophy-case">
                    <StreakBadge
                        label={getLabel('habits')}
                        count={ritualStreak}
                        icon={getIcon('habits')}
                        color="var(--text-gold)"
                    />
                </div>
            </div>

            {/* One grid. Widgets opt into a wider cell via span, so the cards
                carrying today's signal are not the same size as a bookmark
                list.

                Four cards left after an audit of what each was actually
                showing. Three of them — the rituals, the tasks and the
                shopping — were a second rendering of the three lists already
                on the Today card directly above them; their add and delete
                controls moved into it. The fourth was a rack of links to
                Notion, Gmail, Spotify and GitHub, which is a browser bar.

                The Status Console went with them: with no URL configured it
                was not a status console, it was its own setup form, sitting
                at double width on the home screen. That question belongs in
                Settings.

                A second pass took five more. Supplies was not a duplicate —
                it held the shopping list the meal plan implies — so rather
                than delete it, its work moved into Today's "to buy", where the
                other half of the same list already was. The Crowd, The Plan,
                Pastimes, Physical Readiness and the crossword tile went for
                the plainer reason: two of them had never held a row, two had
                not been touched since February, and the last was a link. */}
            {/* Which card, by id. The order and the widths come from her
                settings; this only says what each id draws. */}
            <div className="dashboard-arrange">
                <Button
                    size="sm"
                    variant={arranging ? 'solid' : 'ghost'}
                    onClick={() => setArranging((v) => !v)}
                    label={arranging ? 'Finish arranging the dashboard' : 'Arrange the dashboard'}
                >
                    {arranging ? <><GiCheckMark /> Done</> : <><GiMove /> Arrange</>}
                </Button>
                {arranging && (
                    <span className="dashboard-arrange__hint">
                        Drag a card to move it, or press its width to make it wider.
                    </span>
                )}
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={({ active, over }) => rearrange(active?.id, over?.id)}
            >
                <SortableContext items={order} strategy={rectSortingStrategy}>
                    <div className={`widget-masonry${arranging ? ' is-arranging' : ''}`}>
                        {order.map((id) => {
                            const draw = WIDGETS[id];
                            if (!draw) return null;
                            return (
                                <DashSlot
                                    key={id}
                                    id={id}
                                    span={widthOf(id)}
                                    arranging={arranging}
                                    label={NAMES[id] || id}
                                    onResize={widen}
                                >
                                    {draw({ mealPlan, recipes })}
                                </DashSlot>
                            );
                        })}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
};

export default Dashboard;
