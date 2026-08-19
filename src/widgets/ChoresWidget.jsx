import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import WidgetCard from '../components/WidgetCard';
import Button from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
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
        <WidgetCard title={getLabel('chores')} icon={getIcon('chores')} scroll>
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
                    aria-label={`New task for ${selectedRoom}`}
                />
                <Button icon size="sm" type="submit" className="chores-add-btn" label={`Add ${getLabel('chores').toLowerCase()} to ${selectedRoom}`}>+</Button>
            </form>

            {/* List */}
            <div className="chores-list">
                {visibleChores.length === 0 && !loading && (
                    <EmptyState
                        message="No maintenance required in this sector."
                        icon={getIcon('chores')}
                        inline
                    />
                )}
                {visibleChores.map(chore => (
                    <div key={chore.id} className="chores-item">
                        <button
                            type="button"
                            onClick={() => toggleChore(chore.id)}
                            className="chores-toggle"
                            aria-pressed={!!chore.completed}
                        >
                            <span className={`chores-checkbox ${chore.completed ? 'completed' : ''}`}>
                                {chore.completed && <span className="chores-check-icon">✓</span>}
                            </span>
                            <span className={`chores-text ${chore.completed ? 'completed' : ''}`}>
                                {chore.text}
                            </span>
                        </button>
                        <Button
                            icon
                            size="sm"
                            className="chores-delete-btn"
                            onClick={() => deleteChore(chore.id)}
                            label={`Delete ${getLabel('chores').toLowerCase()} "${chore.text}"`}
                        >
                            ×
                        </Button>
                    </div>
                ))}
            </div>
        </WidgetCard>
    );
};

export default ChoresWidget;
