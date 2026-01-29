import React, { useState } from 'react';
import { GiPalette } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import { useHobbies } from '../hooks/useHobbies';
import ProgressBar from '../components/gamification/ProgressBar';

const HobbiesWidget = () => {
    const { hobbies, addHobby, toggleStatus, deleteHobby, logSession, loading } = useHobbies();
    const [newItem, setNewItem] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        addHobby(newItem);
        setNewItem('');
    };

    return (
        <WidgetCard title="Active Pursuits" icon={GiPalette}>
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder={loading ? 'Loading...' : 'New Interest...'}
                    disabled={loading}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border-dim)',
                        padding: '0.5rem',
                        color: 'var(--text-main)',
                        fontSize: '0.9rem'
                    }}
                />
                <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-gold)', cursor: 'pointer', fontSize: '1.2rem' }}>+</button>
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {hobbies.map(hobby => {
                    // Check if tracked as active today (simple check for now)
                    const isActiveToday = hobby.last_session && new Date(hobby.last_session).toDateString() === new Date().toDateString();

                    return (
                        <div key={hobby.id}
                            style={{
                                border: '1px solid var(--border-dim)',
                                padding: '0.8rem',
                                borderRadius: '4px',
                                background: hobby.status === 'Active' ? 'rgba(207, 181, 59, 0.1)' : 'transparent',
                                opacity: hobby.status === 'Active' ? 1 : 0.6,
                                position: 'relative'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                <span style={{ fontWeight: 'bold', fontFamily: 'var(--font-display)', color: hobby.status === 'Active' ? 'var(--text-gold)' : 'var(--text-muted)' }}>
                                    {hobby.name}
                                </span>
                                <button onClick={() => deleteHobby(hobby.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>×</button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => toggleStatus(hobby.id)}
                                    style={{
                                        flex: 1,
                                        fontSize: '0.7rem',
                                        padding: '2px 6px',
                                        border: '1px solid var(--border-dim)',
                                        background: 'transparent',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {hobby.status}
                                </button>
                                {hobby.status === 'Active' && (
                                    <button
                                        onClick={() => logSession(hobby.id)}
                                        disabled={isActiveToday}
                                        style={{
                                            flex: 1,
                                            fontSize: '0.7rem',
                                            padding: '2px 6px',
                                            border: '1px solid var(--accent-gold)',
                                            background: isActiveToday ? 'var(--accent-gold)' : 'transparent',
                                            color: isActiveToday ? 'var(--bg-main)' : 'var(--accent-gold)',
                                            cursor: isActiveToday ? 'default' : 'pointer'
                                        }}
                                    >
                                        {isActiveToday ? 'Logged' : 'Log Session'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-dim)', paddingTop: '0.5rem' }}>
                <ProgressBar
                    current={hobbies.filter(h => h.last_session && new Date(h.last_session).toDateString() === new Date().toDateString()).length}
                    max={hobbies.filter(h => h.status === 'Active').length}
                    icon={<GiPalette />}
                    color="var(--accent-gold)"
                />
            </div>
        </WidgetCard>
    );
};

export default HobbiesWidget;
