import React, { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import WidgetCard from '../components/WidgetCard';
import Button from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
import { useChores } from '../hooks/useChores';
import { roomsFrom, pickRoom, tidyRoom, roomKey, MISC } from '../utils/rooms';
import '../styles/ChoresWidget.css';

/**
 * The chore board.
 *
 * It used to list five rooms as a constant and filter on an exact string
 * match, which meant a chore filed anywhere else was in the table, still
 * incomplete, and had no tab that would ever show it. Four of the six rooms
 * actually in use had no tab — the Guest Room, the Guest Bathroom, the
 * Laundry Room and the Main Bedroom — so more than half the open chores were
 * invisible. Nothing was broken and nothing was reported; they were simply
 * not on screen.
 *
 * The rooms come from the chores now. Whatever something is filed under is a
 * room, because it was just used as one. A room can be made here on the way
 * to typing a chore into it, and anything with no room at all lands in Misc,
 * which exists so that "I could not work out where this goes" never means
 * "this is gone".
 */
const ChoresWidget = () => {
    const { chores, addChore, toggleChore, deleteChore, loading } = useChores();
    const { getLabel, getIcon } = useTheme();

    const [newItem, setNewItem] = useState('');
    const [current, setCurrent] = useState('');
    /* Rooms made here but not yet filed in. Without this, making a room and
       then typing the chore into it would lose the room on the next render. */
    const [made, setMade] = useState([]);
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');

    const rooms = useMemo(() => roomsFrom(chores, made), [chores, made]);
    // Never a tab that is not there: a room emptied or renamed elsewhere
    // would otherwise leave the board showing nothing with no way back.
    const activeKey = pickRoom(rooms, current);
    const active = rooms.find((r) => r.key === activeKey);

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newItem.trim() || !active) return;
        addChore(newItem.trim(), active.name);
        setNewItem('');
    };

    const makeRoom = (e) => {
        e.preventDefault();
        const room = tidyRoom(name);
        if (!name.trim()) { setNaming(false); return; }
        setMade((m) => (m.some((r) => roomKey(r) === roomKey(room)) ? m : [...m, room]));
        setCurrent(room);
        setName('');
        setNaming(false);
    };

    const visible = active?.chores || [];

    return (
        <WidgetCard title={getLabel('chores')} icon={getIcon('chores')} scroll>
            <div className="chores-room-tabs">
                {rooms.map((room) => (
                    <button
                        key={room.key}
                        type="button"
                        onClick={() => setCurrent(room.name)}
                        className={`chores-room-btn${room.key === activeKey ? ' active' : ''}${room.name === MISC ? ' is-misc' : ''}`}
                        aria-pressed={room.key === activeKey}
                    >
                        {room.name}
                        {/* What is left to do there. A tab with nothing open
                            reads as done rather than as empty. */}
                        {room.open > 0 && <span className="chores-room-count">{room.open}</span>}
                    </button>
                ))}

                {naming ? (
                    <form onSubmit={makeRoom} className="chores-room-new">
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={makeRoom}
                            onKeyDown={(e) => { if (e.key === 'Escape') { setName(''); setNaming(false); } }}
                            placeholder="Room name"
                            aria-label="Name the new room"
                        />
                    </form>
                ) : (
                    <button
                        type="button"
                        className="chores-room-btn chores-room-add"
                        onClick={() => setNaming(true)}
                        aria-label="Add a room"
                    >
                        + room
                    </button>
                )}
            </div>

            <form onSubmit={handleAdd} className="chores-form">
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder={active ? `Task for ${active.name}…` : 'Make a room first…'}
                    disabled={loading || !active}
                    className="chores-input"
                    aria-label={`New task for ${active?.name || 'a room'}`}
                />
                <Button
                    icon
                    size="sm"
                    type="submit"
                    className="chores-add-btn"
                    disabled={!active}
                    label={`Add ${getLabel('chores').toLowerCase()} to ${active?.name || 'a room'}`}
                >
                    +
                </Button>
            </form>

            <div className="chores-list">
                {visible.length === 0 && !loading && (
                    <EmptyState
                        message="No maintenance required in this sector."
                        icon={getIcon('chores')}
                        inline
                    />
                )}
                {visible.map((chore) => (
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
