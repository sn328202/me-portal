import React, { useMemo, useState } from 'react';
import { GiSunrise, GiCheckMark } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import WidgetLoading from '../components/WidgetLoading';
import { useTodos } from '../hooks/useTodos';
import { useProvisions } from '../hooks/useProvisions';
import { useHabits } from '../hooks/useHabits';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/TodayWidget.css';

/**
 * Everything with a checkbox, in one place.
 *
 * On a phone the dashboard opened with a 64px greeting and two streak tiles,
 * so the first screen carried no actual information. This is the answer to
 * "what do I need to do or buy", which is the question being asked while
 * standing in a shop or halfway out of the door — and every line is actionable
 * where it sits, without opening a room.
 *
 * It is now also the only place those lines are *made*. The dashboard used to
 * carry this card and then, directly underneath it, three more cards showing
 * the same three lists again — the rituals twice, the tasks twice, the
 * shopping twice. The reason it could not simply lose them was that the
 * duplicates held the add and delete controls and this card only ticked, so
 * removing them would have left her able to tick a habit and unable to write
 * one. So they moved here, and the duplicates went.
 *
 * Deliberately not a scrolling widget: a card that scrolls inside a page that
 * also scrolls is miserable on a phone, and the lists are capped so the card
 * cannot run away.
 */

const Row = ({ done, label, onToggle, onRemove, removeLabel }) => (
    <li className={`today__row${done ? ' today__row--done' : ''}`}>
        <button
            type="button"
            className="today__check"
            role="checkbox"
            aria-checked={done}
            onClick={onToggle}
        >
            <span className="today__box" aria-hidden="true">{done && <GiCheckMark />}</span>
            <span className="today__label">{label}</span>
        </button>
        {onRemove && (
            <button
                type="button"
                className="today__remove"
                aria-label={removeLabel}
                onClick={onRemove}
            >
                ×
            </button>
        )}
    </li>
);

/* One line to write the next one. Quiet until it is used — a group with
   nothing in it should read as an empty list, not as a form. */
const AddRow = ({ placeholder, onAdd, label }) => {
    const [text, setText] = useState('');
    const submit = (e) => {
        e.preventDefault();
        const value = text.trim();
        if (!value) return;
        onAdd(value);
        setText('');
    };
    return (
        <form className="today__add" onSubmit={submit}>
            <input
                type="text"
                value={text}
                aria-label={label}
                placeholder={placeholder}
                onChange={(e) => setText(e.target.value)}
            />
        </form>
    );
};

const Group = ({ title, count, children, empty, add }) => (
    <section className="today__group">
        <h3 className="today__group-title">
            {title}
            {count > 0 && <span className="today__count">{count}</span>}
        </h3>
        {count > 0 ? <ul className="today__list">{children}</ul> : <p className="today__empty">{empty}</p>}
        {add}
    </section>
);

const TodayWidget = () => {
    const { todos, toggleTodo, addTodo, deleteTodo, loading: todosLoading } = useTodos();
    const { items, toggleItem, addItem, deleteItem, loading: provisionsLoading } = useProvisions();
    const { habits, toggleHabit, addHabit, deleteHabit, loading: habitsLoading } = useHabits();
    const { getLabel } = useTheme();

    const loading = todosLoading || provisionsLoading || habitsLoading;

    // Unfinished things first; anything ticked today stays visible underneath
    // so it reads as progress rather than vanishing the moment it is done.
    const openTodos = useMemo(() => (todos || []).filter((t) => !t.completed).slice(0, 8), [todos]);
    const openGroceries = useMemo(() => (items || []).filter((i) => !i.checked).slice(0, 10), [items]);
    const openHabits = useMemo(() => (habits || []).filter((h) => !h.completed), [habits]);
    const doneHabits = useMemo(() => (habits || []).filter((h) => h.completed), [habits]);

    const ritualLabel = getLabel('habits') || 'Rituals';

    return (
        <WidgetCard title="Today" icon={<GiSunrise />} span={2}>
            {loading ? (
                <WidgetLoading />
            ) : (
                <div className="today">
                    <Group
                        title={ritualLabel}
                        count={openHabits.length}
                        empty={doneHabits.length ? 'All done today.' : 'None set.'}
                        add={<AddRow
                            label={`Add a ${ritualLabel.toLowerCase()}`}
                            placeholder="Something you do every day…"
                            onAdd={addHabit}
                        />}
                    >
                        {openHabits.map((h) => (
                            <Row
                                key={h.id}
                                label={h.text}
                                done={false}
                                onToggle={() => toggleHabit(h.id)}
                                onRemove={() => deleteHabit(h.id)}
                                removeLabel={`Remove ${h.text}`}
                            />
                        ))}
                    </Group>

                    <Group
                        title="Tasks"
                        count={openTodos.length}
                        empty="Nothing on the list."
                        add={<AddRow
                            label="Add a task"
                            placeholder="Something to do…"
                            onAdd={addTodo}
                        />}
                    >
                        {openTodos.map((t) => (
                            <Row
                                key={t.id}
                                label={t.text}
                                done={false}
                                onToggle={() => toggleTodo(t.id)}
                                onRemove={() => deleteTodo(t.id)}
                                removeLabel={`Remove ${t.text}`}
                            />
                        ))}
                    </Group>

                    <Group
                        title="To buy"
                        count={openGroceries.length}
                        empty="Nothing to pick up."
                        add={<AddRow
                            label="Add something to buy"
                            placeholder="Something to pick up…"
                            onAdd={addItem}
                        />}
                    >
                        {openGroceries.map((i) => (
                            <Row
                                key={i.id}
                                label={i.text}
                                done={false}
                                onToggle={() => toggleItem(i.id)}
                                onRemove={() => deleteItem(i.id)}
                                removeLabel={`Remove ${i.text}`}
                            />
                        ))}
                    </Group>
                </div>
            )}
        </WidgetCard>
    );
};

export default TodayWidget;
