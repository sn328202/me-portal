import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import WidgetCard from '../components/WidgetCard';
import { useGoals } from '../hooks/useGoals';
import EmptyState from '../components/EmptyState';
import '../styles/GoalsWidget.css';

const HORIZONS = ['Immediate', 'Short Term', 'Long Term', 'Lifetime'];

const GoalsWidget = () => {
    const { goals, addGoal, deleteGoal, loading } = useGoals();
    const { getLabel, getIcon } = useTheme();
    const [newGoal, setNewGoal] = useState('');
    const [selectedHorizon, setSelectedHorizon] = useState(HORIZONS[0]);
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newGoal.trim()) return;
        addGoal(newGoal, selectedHorizon);
        setNewGoal('');
        setIsAdding(false);
    };

    // Grouping
    const groupedGoals = HORIZONS.reduce((acc, horizon) => {
        acc[horizon] = goals.filter(g => g.horizon === horizon);
        return acc;
    }, {});

    return (
        <WidgetCard title={getLabel('goals')} icon={getIcon('goals')} actionIcon={isAdding ? null : '+'} onAction={() => setIsAdding(true)}>
            {isAdding && (
                <form onSubmit={handleAdd} className="goals-form">
                    <select
                        value={selectedHorizon}
                        onChange={e => setSelectedHorizon(e.target.value)}
                        className="goals-select"
                    >
                        {HORIZONS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <input
                        placeholder="New Objective..."
                        value={newGoal} onChange={e => setNewGoal(e.target.value)}
                        className="goals-input"
                    />
                    <div className="goals-form-controls">
                        <button type="submit" className="goals-commit-btn">Commit</button>
                        <button type="button" onClick={() => setIsAdding(false)} className="goals-cancel-btn">Cancel</button>
                    </div>
                </form>
            )}

            <div className="goals-list-container">
                {HORIZONS.map(horizon => (
                    groupedGoals[horizon] && groupedGoals[horizon].length > 0 && (
                        <div key={horizon} className="goals-horizon-section">
                            <h4 className="goals-horizon-title">
                                {horizon}
                            </h4>
                            <div className="goals-items-list">
                                {groupedGoals[horizon].map(goal => (
                                    <div key={goal.id} className="goals-item">
                                        <span className="goals-item-text">{goal.text}</span>
                                        <button onClick={() => deleteGoal(goal.id)} className="goals-delete-btn">×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}
                {goals.length === 0 && !isAdding && !loading && (
                    <EmptyState
                        message={`No ${getLabel('goals').toLowerCase()} mapped. Define your horizons.`}
                        actionLabel={`Set ${getLabel('goals')}`}
                        onAction={() => setIsAdding(true)}
                        icon={getIcon('goals')}
                    />
                )}
            </div>
        </WidgetCard>
    );
};

export default GoalsWidget;
