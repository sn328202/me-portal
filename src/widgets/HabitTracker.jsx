import React, { useState } from 'react';
import { useHabits } from '../hooks/useHabits';
import { GiCheckMark, GiTrashCan } from 'react-icons/gi';
import { useTheme } from '../contexts/ThemeContext';
import ProgressBar from '../components/gamification/ProgressBar';
import WidgetCard from '../components/WidgetCard';
import WidgetLoading from '../components/WidgetLoading';
import EmptyState from '../components/EmptyState';
import Button from '../components/ui/Button';
import '../styles/HabitTracker.css';

const HabitTracker = () => {
    const { habits, toggleHabit, addHabit, deleteHabit, loading } = useHabits();
    const { getLabel, getIcon } = useTheme();
    const [newHabit, setNewHabit] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newHabit.trim()) {
            addHabit(newHabit);
            setNewHabit('');
            setIsAdding(false);
        }
    };

    const noun = getLabel('habits').toLowerCase();

    return (
        <WidgetCard
            title={getLabel('habits')}
            icon={getIcon('habits')}
            className="habit-tracker"
            scroll="tall"
            onAction={() => setIsAdding(!isAdding)}
            actionIcon={isAdding ? '×' : '+'}
            actionLabel={isAdding ? `Cancel adding ${noun}` : `Add ${noun}`}
        >
            {loading ? (
                <WidgetLoading />
            ) : (
                <>
                    {isAdding && (
                        <form onSubmit={handleSubmit} className="habit-form">
                            <input
                                autoFocus
                                type="text"
                                value={newHabit}
                                onChange={(e) => setNewHabit(e.target.value)}
                                placeholder={`New ${noun}...`}
                                aria-label={`New ${noun}`}
                                className="input habit-input"
                            />
                        </form>
                    )}

                    {habits.length === 0 && !isAdding ? (
                        <EmptyState
                            message={`No ${noun} established. Start your first ritual.`}
                            actionLabel={`Add ${getLabel('habits')}`}
                            onAction={() => setIsAdding(true)}
                            icon={getIcon('habits')}
                        />
                    ) : (
                        <ul className="habit-list">
                            {habits.map(habit => (
                                <li key={habit.id} className={`habit-item ${habit.completed ? 'completed' : ''}`}>
                                    <button
                                        type="button"
                                        onClick={() => toggleHabit(habit.id)}
                                        className="habit-item-content"
                                        aria-pressed={!!habit.completed}
                                    >
                                        <span className={`habit-checkbox ${habit.completed ? 'completed' : ''}`}>
                                            {habit.completed && <GiCheckMark size={12} color="var(--bg-main)" />}
                                        </span>
                                        <span className={`habit-text ${habit.completed ? 'completed' : ''}`}>
                                            {habit.text}
                                        </span>
                                    </button>
                                    <Button
                                        icon
                                        size="sm"
                                        className="habit-delete-btn"
                                        onClick={() => deleteHabit(habit.id)}
                                        label={`Delete ${noun} "${habit.text}"`}
                                    >
                                        <GiTrashCan />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            <div className="habit-progress-area">
                <ProgressBar
                    current={habits.filter(h => h.completed).length}
                    max={habits.length}
                    icon={getIcon('habits')}
                    color="var(--accent-gold)"
                />
            </div>
        </WidgetCard>
    );
};

export default HabitTracker;
