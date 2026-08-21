import React, { useMemo } from 'react';
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
 * Deliberately not a scrolling widget: a card that scrolls inside a page that
 * also scrolls is miserable on a phone, and the lists are capped so the card
 * cannot run away.
 */

const Row = ({ done, label, onToggle }) => (
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
    </li>
);

const Group = ({ title, count, children, empty }) => (
    <section className="today__group">
        <h3 className="today__group-title">
            {title}
            {count > 0 && <span className="today__count">{count}</span>}
        </h3>
        {count > 0 ? <ul className="today__list">{children}</ul> : <p className="today__empty">{empty}</p>}
    </section>
);

const TodayWidget = () => {
    const { todos, toggleTodo, loading: todosLoading } = useTodos();
    const { items, toggleItem, loading: provisionsLoading } = useProvisions();
    const { habits, toggleHabit, loading: habitsLoading } = useHabits();
    const { getLabel } = useTheme();

    const loading = todosLoading || provisionsLoading || habitsLoading;

    // Unfinished things first; anything ticked today stays visible underneath
    // so it reads as progress rather than vanishing the moment it is done.
    const openTodos = useMemo(() => (todos || []).filter((t) => !t.completed).slice(0, 8), [todos]);
    const openGroceries = useMemo(() => (items || []).filter((i) => !i.checked).slice(0, 10), [items]);
    const openHabits = useMemo(() => (habits || []).filter((h) => !h.completed), [habits]);
    const doneHabits = useMemo(() => (habits || []).filter((h) => h.completed), [habits]);

    const nothingLeft =
        !loading && !openTodos.length && !openGroceries.length && !openHabits.length;

    return (
        <WidgetCard title="Today" icon={<GiSunrise />} span={2}>
            {loading ? (
                <WidgetLoading />
            ) : nothingLeft ? (
                <p className="today__all-clear">Nothing outstanding. Everything is ticked.</p>
            ) : (
                <div className="today">
                    <Group
                        title={getLabel('habits') || 'Rituals'}
                        count={openHabits.length}
                        empty={doneHabits.length ? 'All done today.' : 'None set.'}
                    >
                        {openHabits.map((h) => (
                            <Row key={h.id} label={h.text} done={false} onToggle={() => toggleHabit(h.id)} />
                        ))}
                    </Group>

                    <Group title="Tasks" count={openTodos.length} empty="Nothing on the list.">
                        {openTodos.map((t) => (
                            <Row key={t.id} label={t.text} done={false} onToggle={() => toggleTodo(t.id)} />
                        ))}
                    </Group>

                    <Group title="To buy" count={openGroceries.length} empty="Nothing to pick up.">
                        {openGroceries.map((i) => (
                            <Row key={i.id} label={i.text} done={false} onToggle={() => toggleItem(i.id)} />
                        ))}
                    </Group>
                </div>
            )}
        </WidgetCard>
    );
};

export default TodayWidget;
