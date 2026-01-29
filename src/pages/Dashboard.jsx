import React from 'react';
import GreetingWidget from '../widgets/GreetingWidget';
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
import { useRecipes } from '../hooks/useRecipes';
import { useHabits } from '../hooks/useHabits';
import { useHobbies } from '../hooks/useHobbies';
import StreakBadge from '../components/gamification/StreakBadge';
import { GiCandleLight, GiPaintBrush } from 'react-icons/gi';

const Dashboard = () => {
    const { mealPlan, recipes } = useRecipes();
    const { streak: ritualStreak } = useHabits();
    const { streak: pursuitStreak } = useHobbies();

    return (
        <div style={{
            height: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
            paddingBottom: '2rem',
            overflowY: 'auto'
        }}>
            {/* Header: Greeting */}
            <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                    <GreetingWidget />
                </div>
                {/* Trophy Case */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <StreakBadge label="Ritual Streak" count={ritualStreak} icon={<GiCandleLight />} color="#d4af37" />
                    <StreakBadge label="Pursuit Streak" count={pursuitStreak} icon={<GiPaintBrush />} color="#c0c0c0" />
                </div>
            </div>

            {/* Row 1: Daily Operations */}
            <div style={{ gridColumn: 'span 1' }}>
                <HabitTracker />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
                <TodoWidget />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
                <ProvisionsWidget plan={mealPlan} recipes={recipes} />
            </div>

            {/* Row 2: Life Management (Estate, Social, Goals) */}
            <div style={{ gridColumn: 'span 1' }}>
                <ChoresWidget />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
                <SocialWidget />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
                <GoalsWidget />
            </div>

            {/* Row 3: Leisure & Long Term */}
            <div style={{ gridColumn: 'span 1' }}>
                <HobbiesWidget />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
                <TravelWidget />
            </div>
            {/* Library Stats typically wide, but if we want 3 cols... let's keep it span 1 or span 3 below? 
                User asked for "hobbies list", "travel plans list". 
                Let's make LibraryStats span 3 again as a "Footer" or squeeze it in?
                Actually, LibraryStats was redesigned to allow span 3. 
                Let's put LibraryStats as a full width banner again, or span 1 if it fits conceptually.
                For now, let's span 1 to fit the row. Wait, Library has 5 columns inside. It needs width.
                Let's make Library Stats span 3 BELOW this row.
             */}

            {/* Row 4: Calendar */}
            <div style={{ gridColumn: 'span 3' }}>
                <CalendarWidget />
            </div>

            {/* Row 5: Library Stats (Wide) */}
            <div style={{ gridColumn: 'span 3', minHeight: '300px' }}>
                <LibraryStats />
            </div>
        </div>
    );
};

export default Dashboard;
