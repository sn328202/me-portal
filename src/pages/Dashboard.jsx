import React from 'react';
import GreetingWidget from '../widgets/GreetingWidget';
import { useAuth } from '../contexts/AuthContext';
import HabitTracker from '../widgets/HabitTracker';
import LibraryStats from '../widgets/LibraryStats';
import ProvisionsWidget from '../widgets/ProvisionsWidget';
import TodoWidget from '../widgets/TodoWidget';
import CalendarWidget from '../widgets/CalendarWidget';
import ChoresWidget from '../widgets/ChoresWidget';
import SocialWidget from '../widgets/SocialWidget';
import GoalsWidget from '../widgets/GoalsWidget';
import HobbiesWidget from '../widgets/HobbiesWidget';
import TravelWidget from '../widgets/TravelWidget';
import StatusConsole from '../widgets/StatusConsole';
import QuickLinksWidget from '../widgets/QuickLinksWidget';
import GameLauncher from '../widgets/GameLauncher';
import WorkoutWidget from '../widgets/WorkoutWidget';
import CapturesWidget from '../widgets/CapturesWidget';
import { useRecipes } from '../hooks/useRecipes';
import { useHabits } from '../hooks/useHabits';
import { useHobbies } from '../hooks/useHobbies';
import { useDashboardSettings } from '../hooks/useDashboardSettings';
import { useTheme } from '../contexts/ThemeContext';
import StreakBadge from '../components/gamification/StreakBadge';
import WelcomeHero from '../components/WelcomeHero';
import '../styles/Dashboard.css';

const Dashboard = () => {
    const { user } = useAuth();
    const { mealPlan, recipes, loading: recipesLoading } = useRecipes();
    const { habits, streak: ritualStreak, loading: habitsLoading } = useHabits();
    const { streak: pursuitStreak } = useHobbies();
    const { isEnabled } = useDashboardSettings();
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

                <div className="trophy-case">
                    <StreakBadge
                        label={`${getLabel('habits')} Streak`}
                        count={ritualStreak}
                        icon={getIcon('habits')}
                        color="var(--text-gold)"
                    />
                    <StreakBadge
                        label={`${getLabel('hobbies')} Streak`}
                        count={pursuitStreak}
                        icon={getIcon('hobbies')}
                        color="var(--text-muted)"
                    />
                </div>
            </div>

            {/* One grid. Widgets opt into a wider cell via span, so the cards
                carrying today's signal are not the same size as a bookmark
                list. Order is unchanged. */}
            <div className="widget-masonry">
                {isEnabled('captures') && <CapturesWidget />}
                {isEnabled('habits') && <HabitTracker />}
                {isEnabled('todos') && <TodoWidget />}
                {isEnabled('provisions') && <ProvisionsWidget plan={mealPlan} recipes={recipes} />}
                {isEnabled('chores') && <ChoresWidget />}
                {isEnabled('social') && <SocialWidget />}
                {isEnabled('goals') && <GoalsWidget />}
                {isEnabled('hobbies') && <HobbiesWidget />}
                {isEnabled('travel') && <TravelWidget />}
                {isEnabled('workouts') && <WorkoutWidget />}
                {isEnabled('links') && <QuickLinksWidget />}
                {isEnabled('games') && (
                    <GameLauncher
                        title="The Crossword"
                        icon={getIcon('games')}
                        url="https://www.nytimes.com/crosswords/game/daily"
                        description="The daily crossword challenge."
                    />
                )}
                {isEnabled('status') && <StatusConsole />}
                {isEnabled('calendar') && <CalendarWidget />}
                {isEnabled('library') && <LibraryStats />}
            </div>
        </div>
    );
};

export default Dashboard;
