import React, { useState } from 'react';
import { useHabits } from '../hooks/useHabits';
import { GiCheckMark, GiTrashCan, GiCandleLight } from 'react-icons/gi';
import { useTheme } from '../contexts/ThemeContext';
import ProgressBar from '../components/gamification/ProgressBar';
import WidgetLoading from '../components/WidgetLoading';
import EmptyState from '../components/EmptyState';
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

    return (
        <div className="habit-tracker-widget">
            <div className="habit-header">
                <h3 className="habit-title">
                    {getIcon('habits')} {getLabel('habits')}
                </h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="habit-toggle-btn"
                    aria-label={isAdding ? `Cancel adding ${getLabel('habits').toLowerCase()}` : `Add ${getLabel('habits').toLowerCase()}`}
                >+</button>
            </div>

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
                                placeholder={`New ${getLabel('habits').toLowerCase()}...`}
                                className="habit-input"
                            />
                        </form>
                    )}

                    {habits.length === 0 && !isAdding ? (
                        <EmptyState
                            message={`No ${getLabel('habits').toLowerCase()} established. Start your first ritual.`}
                            actionLabel={`Add ${getLabel('habits')}`}
                            onAction={() => setIsAdding(true)}
                            icon={getIcon('habits')}
                        />
                    ) : (
                        <ul className="habit-list">
                            {habits.map(habit => (
                                <li key={habit.id} className={`habit-item ${habit.completed ? 'completed' : ''}`}>
                                    <div
                                        onClick={() => toggleHabit(habit.id)}
                                        className="habit-item-content"
                                    >
                                        <div className={`habit-checkbox ${habit.completed ? 'completed' : ''}`}>
                                            {habit.completed && <GiCheckMark size={12} color="var(--bg-main)" />}
                                        </div>
                                        <span className={`habit-text ${habit.completed ? 'completed' : ''}`}>
                                            {habit.text}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => deleteHabit(habit.id)}
                                        className="habit-delete-btn"
                                        aria-label={`Delete habit "${habit.text}"`}
                                    >
                                        <GiTrashCan />
                                    </button>
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
        </div>
    );
};

export default HabitTracker;
