import React, { useState } from 'react';
import { GiFeather, GiCheckMark, GiEmptyHourglass, GiTrashCan } from 'react-icons/gi';
import { useTheme } from '../contexts/ThemeContext';
import ProgressBar from '../components/gamification/ProgressBar';
import { useTodos } from '../hooks/useTodos';
import EmptyState from '../components/EmptyState';
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
        <div className="widget-card todo-widget">
            <div className="widget-header">
                <h3 className="widget-title">
                    {getIcon('todos')} {getLabel('todos')}
                </h3>
            </div>
            <div className="widget-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <form onSubmit={handleSubmit} className="todo-form">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={loading ? "Loading..." : "New entry..."}
                        disabled={loading}
                        className="todo-input"
                    />
                    <button
                        type="submit"
                        className="todo-add-btn"
                        disabled={loading}
                    >
                        <GiFeather size={20} />
                    </button>
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
                            <button onClick={() => toggleTodo(todo.id)} className="todo-status-btn">
                                {todo.completed ? <GiCheckMark size={16} /> : <GiEmptyHourglass size={16} />}
                            </button>
                            <span className="todo-text">
                                {todo.text}
                            </span>
                            <button onClick={() => deleteTodo(todo.id)} className="todo-delete-btn">
                                <GiTrashCan size={14} />
                            </button>
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
            </div>
        </div>
    );
};

export default TodoWidget;
