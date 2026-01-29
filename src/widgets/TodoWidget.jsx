import React, { useState } from 'react';
import { GiFeather, GiCheckMark, GiEmptyHourglass, GiTrashCan } from 'react-icons/gi';
import ProgressBar from '../components/gamification/ProgressBar';
import WidgetCard from '../components/WidgetCard';
import { useTodos } from '../hooks/useTodos';

const TodoWidget = () => {
    const { todos, addTodo, toggleTodo, deleteTodo, loading } = useTodos();
    const [input, setInput] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim()) {
            addTodo(input);
            setInput('');
        }
    };

    return (
        <WidgetCard title="Daily Pursuits">
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={loading ? "Loading..." : "New entry..."}
                    disabled={loading}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border-gold)',
                        borderRadius: 0,
                        padding: 'var(--space-sm) 0',
                        color: 'var(--text-main)',
                        outline: 'none',
                        fontFamily: 'var(--font-display)',
                        fontSize: '1rem',
                        fontStyle: 'italic'
                    }}
                />
                <button
                    type="submit"
                    style={{
                        color: 'var(--text-gold)',
                        padding: '0 var(--space-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.8,
                        cursor: loading ? 'wait' : 'pointer'
                    }}
                >
                    <GiFeather size={20} />
                </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {todos.length === 0 && !loading && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: 'var(--space-sm)' }}>Tabula rasa.</div>}

                {todos.map((todo) => (
                    <div
                        key={todo.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-md)',
                            padding: 'var(--space-xs) 0',
                            transition: 'all 0.2s',
                            opacity: todo.completed ? 0.5 : 1
                        }}
                    >
                        <button onClick={() => toggleTodo(todo.id)} style={{ color: todo.completed ? 'var(--accent-gold)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                            {todo.completed ? <GiCheckMark size={16} /> : <GiEmptyHourglass size={16} />}
                        </button>
                        <span style={{
                            flex: 1,
                            textDecoration: todo.completed ? 'line-through' : 'none',
                            fontStyle: 'italic',
                            color: todo.completed ? 'var(--text-muted)' : 'var(--text-main)'
                        }}>
                            {todo.text}
                        </span>
                        <button onClick={() => deleteTodo(todo.id)} style={{ color: 'var(--text-muted)', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}>
                            <GiTrashCan size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-gold)', paddingTop: '0.5rem' }}>
                <ProgressBar
                    current={todos.filter(t => t.completed).length}
                    max={todos.length}
                    icon={<GiFeather />}
                    color="var(--accent-gold)"
                />
            </div>
        </WidgetCard>
    );
};

export default TodoWidget;
