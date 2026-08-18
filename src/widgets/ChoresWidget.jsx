import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import WidgetCard from '../components/WidgetCard';
import { useChores } from '../hooks/useChores';
import '../styles/ChoresWidget.css';

// Defualt rooms
const ROOMS = ['Kitchen', 'Study', 'Bedroom', 'Living Room', 'Bathroom'];

const ChoresWidget = () => {
    const { chores, addChore, toggleChore, deleteChore, loading } = useChores();
    const { getLabel, getIcon } = useTheme();
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
        <WidgetCard title={getLabel('chores')} icon={getIcon('chores')}>
            {/* Room Tabs */}
            <div className="chores-room-tabs">
                {ROOMS.map(room => (
                    <button
                        key={room}
                        onClick={() => setSelectedRoom(room)}
                        className={`chores-room-btn ${selectedRoom === room ? 'active' : ''}`}
                    >
                        {room}
                    </button>
                ))}
            </div>

            {/* Input */}
            <form onSubmit={handleAdd} className="chores-form">
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder={`Task for ${selectedRoom}...`}
                    disabled={loading}
                    className="chores-input"
                />
                <button type="submit" className="chores-add-btn">+</button>
            </form>

            {/* List */}
            <div className="chores-list">
                {visibleChores.length === 0 && !loading && (
                    <div className="chores-empty">
                        No maintenance required in this sector.
                    </div>
                )}
                {visibleChores.map(chore => (
                    <div key={chore.id} className="chores-item">
                        <div
                            onClick={() => toggleChore(chore.id)}
                            className={`chores-checkbox ${chore.completed ? 'completed' : ''}`}
                        >
                            {chore.completed && <span className="chores-check-icon">✓</span>}
                        </div>
                        <span className={`chores-text ${chore.completed ? 'completed' : ''}`}>
                            {chore.text}
                        </span>
                        <button
                            onClick={() => deleteChore(chore.id)}
                            className="chores-delete-btn"
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
