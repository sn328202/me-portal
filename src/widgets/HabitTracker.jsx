import React, { useState } from 'react';
import { useHabits } from '../hooks/useHabits';
import { GiCheckMark, GiTrashCan, GiCandleLight } from 'react-icons/gi';
import ProgressBar from '../components/gamification/ProgressBar';

const HabitTracker = () => {
    const { habits, toggleHabit, addHabit, deleteHabit } = useHabits();
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
        <div className="widget-card" style={{ height: '100%', padding: '1.5rem', background: '#e8e4d9', border: '3px double #3e2723', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #5d4037', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', color: '#3e2723' }}>Daily Rituals</h3>
                <button onClick={() => setIsAdding(!isAdding)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#5d4037' }}>+</button>
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
                    <input
                        autoFocus
                        type="text"
                        value={newHabit}
                        onChange={(e) => setNewHabit(e.target.value)}
                        placeholder="New ritual..."
                        style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.5)', border: '1px solid #5d4037', fontFamily: 'serif' }}
                    />
                </form>
            )}

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0', flex: 1, overflowY: 'auto' }}>
                {habits.map(habit => (
                    <li key={habit.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', opacity: habit.completed ? 0.6 : 1 }}>
                        <div
                            onClick={() => toggleHabit(habit.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', flex: 1 }}
                        >
                            <div style={{
                                width: '20px', height: '20px',
                                border: '2px solid #5d4037', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: habit.completed ? '#5d4037' : 'transparent'
                            }}>
                                {habit.completed && <GiCheckMark size={12} color="#e8e4d9" />}
                            </div>
                            <span style={{
                                textDecoration: habit.completed ? 'line-through' : 'none',
                                fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', color: '#2c1810'
                            }}>
                                {habit.text}
                            </span>
                        </div>
                        <button onClick={() => deleteHabit(habit.id)} style={{ background: 'none', border: 'none', color: '#8d6e63', cursor: 'pointer', opacity: 0.5 }}>
                            <GiTrashCan />
                        </button>
                    </li>
                ))}
            </ul>

            <div style={{ marginTop: 'auto', borderTop: '1px solid #5d4037', paddingTop: '0.5rem' }}>
                <ProgressBar
                    current={habits.filter(h => h.completed).length}
                    max={habits.length}
                    icon={<GiCandleLight />}
                    color="#5d4037"
                />
            </div>
        </div>
    );
};

export default HabitTracker;
