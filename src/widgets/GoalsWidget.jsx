import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import WidgetCard from '../components/WidgetCard';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
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
        <WidgetCard
            title={getLabel('goals')}
            icon={getIcon('goals')}
            scroll
            actionIcon={isAdding ? '×' : '+'}
            actionLabel={isAdding ? 'Cancel new objective' : `Add to ${getLabel('goals')}`}
            onAction={() => setIsAdding(!isAdding)}
        >
            {isAdding && (
                <form onSubmit={handleAdd} className="goals-form">
                    <Field label="Horizon">
                        <select
                            className="select goals-select"
                            value={selectedHorizon}
                            onChange={e => setSelectedHorizon(e.target.value)}
                        >
                            {HORIZONS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </Field>
                    <input
                        placeholder="New Objective..."
                        aria-label={`New ${getLabel('goals').toLowerCase()}`}
                        value={newGoal} onChange={e => setNewGoal(e.target.value)}
                        className="goals-input"
                    />
                    <div className="goals-form-controls">
                        <Button type="submit" variant="solid" size="sm" className="goals-commit-btn">Commit</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
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
                                        <Button
                                            icon
                                            size="sm"
                                            className="goals-delete-btn"
                                            onClick={() => deleteGoal(goal.id)}
                                            label={`Delete ${getLabel('goals').toLowerCase()} "${goal.text}"`}
                                        >
                                            ×
                                        </Button>
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
