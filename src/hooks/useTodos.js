import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useTodos = () => {
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTodos = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .order('id', { ascending: true });

        if (!error) setTodos(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchTodos();
    }, []);

    const toggleTodo = async (id) => {
        const todo = todos.find(t => t.id === id);
        if (!todo) return;

        const newCompleted = !todo.completed;
        setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: newCompleted } : t));

        const { error } = await supabase
            .from('todos')
            .update({ completed: newCompleted })
            .eq('id', id);

        if (error) fetchTodos();
    };

    const addTodo = async (text) => {
        if (!text.trim()) return;

        const tempId = Date.now();
        const newTodo = { id: tempId, text, completed: false };
        setTodos(prev => [...prev, newTodo]);

        const { data, error } = await supabase
            .from('todos')
            .insert([{ text, completed: false }])
            .select()
            .single();

        if (error) {
            console.error('Error adding todo:', error);
            setTodos(prev => prev.filter(t => t.id !== tempId));
        } else {
            setTodos(prev => prev.map(t => t.id === tempId ? data : t));
        }
    };

    const deleteTodo = async (id) => {
        setTodos(prev => prev.filter(t => t.id !== id));
        await supabase.from('todos').delete().eq('id', id);
    };

    return { todos, toggleTodo, addTodo, deleteTodo, loading };
};
