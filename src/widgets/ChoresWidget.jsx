import React, { useState } from 'react';
import { GiBroom } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import { useChores } from '../hooks/useChores';

// Defualt rooms
const ROOMS = ['Kitchen', 'Study', 'Bedroom', 'Living Room', 'Bathroom'];

const ChoresWidget = () => {
    const { chores, addChore, toggleChore, deleteChore, loading } = useChores();
    const [newItem, setNewItem] = useState('');
    const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        addChore(newItem, selectedRoom);
        setNewItem('');
    };

    // Filter by selected room
    const visibleChores = chores.filter(c => c.room === selectedRoom);

    return (
        <WidgetCard title="Estate Maintenance" icon={GiBroom}>
            {/* Room Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-dim)' }}>
                {ROOMS.map(room => (
                    <button
                        key={room}
                        onClick={() => setSelectedRoom(room)}
                        style={{
                            background: selectedRoom === room ? 'var(--text-gold)' : 'transparent',
                            color: selectedRoom === room ? 'var(--bg-main)' : 'var(--text-muted)',
                            border: '1px solid var(--border-dim)',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.7rem',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {room}
                    </button>
                ))}
            </div>

            {/* Input */}
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder={`Task for ${selectedRoom}...`}
                    disabled={loading}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border-dim)',
                        padding: '0.5rem',
                        color: 'var(--text-main)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.9rem'
                    }}
                />
                <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-gold)', cursor: 'pointer', fontSize: '1.2rem' }}>+</button>
            </form>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                {visibleChores.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '1rem' }}>
                        No maintenance required in this sector.
                    </div>
                )}
                {visibleChores.map(chore => (
                    <div key={chore.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                        <div
                            onClick={() => toggleChore(chore.id)}
                            style={{
                                width: '16px', height: '16px',
                                border: '1px solid var(--text-gold)',
                                background: chore.completed ? 'var(--text-gold)' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            {chore.completed && <span style={{ fontSize: '10px', color: 'var(--bg-main)' }}>✓</span>}
                        </div>
                        <span style={{
                            flex: 1,
                            textDecoration: chore.completed ? 'line-through' : 'none',
                            color: chore.completed ? 'var(--text-muted)' : 'var(--text-main)'
                        }}>
                            {chore.text}
                        </span>
                        <button
                            onClick={() => deleteChore(chore.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.5 }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </WidgetCard>
    );
};

export default ChoresWidget;
