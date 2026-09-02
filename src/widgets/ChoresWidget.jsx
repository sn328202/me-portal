import React, { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import WidgetCard from '../components/WidgetCard';
import Button from '../components/ui/Button';
import { useChores } from '../hooks/useChores';
import { board, tidyRoom, roomKey, MISC } from '../utils/rooms';
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

    const view = useMemo(() => board(chores, made), [chores, made]);
    // Where a new chore goes: whatever she last touched, else the first room
    // with something outstanding, else the first room there is.
    const target = view.rooms.find((r) => r.key === roomKey(current))
        || view.rooms.find((r) => r.open > 0)
        || view.rooms[0]
        || null;

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newItem.trim() || !target) return;
        addChore(newItem.trim(), target.name);
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

    return (
        <WidgetCard title={getLabel('chores')} icon={getIcon('chores')} scroll>
            {/* The count, first. Tabs meant checking four rooms to answer
                "is the flat in order", and that question has a one-number
                answer. */}
            <p className="chores-count" role="status">
                {view.empty
                    ? 'Nothing on the list yet.'
                    : view.clean
                        ? '✨ All clean — nothing left to do.'
                        : `${view.open} ${view.open === 1 ? 'thing' : 'things'} to do`}
                {!view.empty && !view.clean && view.done > 0 && (
                    <span className="chores-count__done"> · {view.done} done</span>
                )}
            </p>

            <form onSubmit={handleAdd} className="chores-form">
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder={target ? `Something to do in the ${target.name}…` : 'Make a room first…'}
                    disabled={loading || !target}
                    className="chores-input"
                    aria-label={`New task for ${target?.name || 'a room'}`}
                />
                <Button
                    icon
                    size="sm"
                    type="submit"
                    className="chores-add-btn"
                    disabled={!target}
                    label={`Add ${getLabel('chores').toLowerCase()} to ${target?.name || 'a room'}`}
                >
                    +
                </Button>
            </form>

            {/* One list, every room, scrolling. A room with nothing left falls
                to the bottom rather than out — "the kitchen is done" is worth
                seeing once. */}
            <div className="chores-board">
                {view.rooms.map((room) => (
                    <section
                        key={room.key}
                        className={`chores-room${room.open === 0 ? ' is-done' : ''}${room.name === MISC ? ' is-misc' : ''}`}
                    >
                        <h4 className="chores-room__name">
                            <button
                                type="button"
                                onClick={() => setCurrent(room.name)}
                                aria-label={`Add the next chore to ${room.name}`}
                                className={roomKey(room.name) === roomKey(target?.name) ? 'is-target' : ''}
                            >
                                {room.name}
                            </button>
                            {room.open > 0
                                ? <span className="chores-room__left">{room.open}</span>
                                : room.total > 0 && <span className="chores-room__clear">clear</span>}
                        </h4>

                        {/* With nothing filed anywhere, the five rooms are
                            suggestions of where to type — so they are names to
                            aim at, not five separate announcements that they
                            are empty. */}
                        {room.chores.length === 0 ? (
                            view.empty ? null : <p className="chores-room__empty">Nothing here.</p>
                        ) : room.chores.map((chore) => (
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
                    </section>
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
                    <button type="button" className="chores-room-add" onClick={() => setNaming(true)}>
                        + room
                    </button>
                )}
            </div>
        </WidgetCard>
    );
};

export default ChoresWidget;
