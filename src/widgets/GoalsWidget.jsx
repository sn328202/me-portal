import React, { useState } from 'react';
import { GiMountainClimbing } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import { useGoals } from '../hooks/useGoals';

const HORIZONS = ['Immediate', 'Short Term', 'Long Term', 'Lifetime'];

const GoalsWidget = () => {
    const { goals, addGoal, deleteGoal, loading } = useGoals();
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
        <WidgetCard title="Life Objectives" icon={GiMountainClimbing} actionIcon={isAdding ? null : '+'} onAction={() => setIsAdding(true)}>
            {isAdding && (
                <form onSubmit={handleAdd} style={{ marginBottom: '1rem', padding: '0.5rem', border: '1px dashed var(--border-dim)', background: 'var(--bg-hover)' }}>
                    <select
                        value={selectedHorizon}
                        onChange={e => setSelectedHorizon(e.target.value)}
                        style={{ width: '100%', marginBottom: '0.5rem', background: '#222', border: '1px solid #444', color: 'var(--text-main)', padding: '0.3rem' }}
                    >
                        {HORIZONS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <input
                        placeholder="New Objective..."
                        value={newGoal} onChange={e => setNewGoal(e.target.value)}
                        style={{ width: '100%', marginBottom: '0.5rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="submit" style={{ flex: 1, background: 'var(--text-gold)', border: 'none', padding: '0.2rem', cursor: 'pointer', color: 'var(--bg-main)' }}>Commit</button>
                        <button type="button" onClick={() => setIsAdding(false)} style={{ background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.5rem' }}>Cancel</button>
                    </div>
                </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                {HORIZONS.map(horizon => (
                    groupedGoals[horizon] && groupedGoals[horizon].length > 0 && (
                        <div key={horizon}>
                            <h4 style={{
                                fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                                color: 'var(--text-muted)', borderBottom: '1px solid var(--border-dim)',
                                paddingBottom: '0.2rem', marginBottom: '0.5rem'
                            }}>
                                {horizon}
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {groupedGoals[horizon].map(goal => (
                                    <div key={goal.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span style={{ color: 'var(--text-main)' }}>{goal.text}</span>
                                        <button onClick={() => deleteGoal(goal.id)} style={{ color: '#444', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}
                {goals.length === 0 && !isAdding && !loading && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '1rem' }}>
                        Ambition chart empty.
                    </div>
                )}
            </div>
        </WidgetCard>
    );
};

export default GoalsWidget;
