import React, { useState } from 'react';
import { GiFeather, GiCheckMark, GiEmptyHourglass, GiTrashCan } from 'react-icons/gi';
import { useTheme } from '../contexts/ThemeContext';
import ProgressBar from '../components/gamification/ProgressBar';
import { useTodos } from '../hooks/useTodos';
import WidgetCard from '../components/WidgetCard';
import EmptyState from '../components/EmptyState';
import Button from '../components/ui/Button';
import '../styles/TodoWidget.css';

const TodoWidget = () => {
    const { todos, addTodo, toggleTodo, deleteTodo, loading } = useTodos();
    const { getLabel, getIcon } = useTheme();
    const [input, setInput] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim()) {
            addTodo(input);
            setInput('');
        }
    };

    return (
        <WidgetCard title={getLabel('todos')} icon={getIcon('todos')} className="todo-widget" scroll="tall">
            <form onSubmit={handleSubmit} className="todo-form">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={loading ? 'Loading...' : 'New entry...'}
                    aria-label={`New ${getLabel('todos').toLowerCase()}`}
                    disabled={loading}
                    className="todo-input"
                />
                <Button
                    icon
                    size="sm"
                    type="submit"
                    className="todo-add-btn"
                    label={`Add ${getLabel('todos').toLowerCase()}`}
                    disabled={loading}
                >
                    <GiFeather size={20} />
                </Button>
            </form>

            <div className="todo-list-container">
                {todos.length === 0 && !loading && (
                    <EmptyState
                        message={`Your ${getLabel('todos').toLowerCase()} archives are empty.`}
                        icon={getIcon('todos')}
                    />
                )}

                {todos.map((todo) => (
                    <div
                        key={todo.id}
                        className={`todo-item ${todo.completed ? 'completed' : ''}`}
                    >
                        <Button
                            icon
                            size="sm"
                            className="todo-status-btn"
                            onClick={() => toggleTodo(todo.id)}
                            label={todo.completed ? `Mark "${todo.text}" as not done` : `Mark "${todo.text}" as done`}
                            aria-pressed={!!todo.completed}
                        >
                            {todo.completed ? <GiCheckMark size={16} /> : <GiEmptyHourglass size={16} />}
                        </Button>
                        <span className="todo-text">
                            {todo.text}
                        </span>
                        <Button
                            icon
                            size="sm"
                            className="todo-delete-btn"
                            onClick={() => deleteTodo(todo.id)}
                            label={`Delete ${getLabel('todos').toLowerCase()} "${todo.text}"`}
                        >
                            <GiTrashCan size={14} />
                        </Button>
                    </div>
                ))}
            </div>

            <div className="todo-progress-area">
                <ProgressBar
                    current={todos.filter(t => t.completed).length}
                    max={todos.length}
                    icon={getIcon('todos')}
                    color="var(--accent-gold)"
                />
            </div>
        </WidgetCard>
    );
};

export default TodoWidget;
