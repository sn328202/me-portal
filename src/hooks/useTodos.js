import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCaptureRevision } from '../contexts/CaptureContext';

export const useTodos = () => {
    const { user } = useAuth();
    // Refetch when a quick capture writes to this table.
    const revision = useCaptureRevision();
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTodos = async () => {
        if (!user) {
            setTodos([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', user.id)
            .order('id', { ascending: true });

        if (!error) setTodos(data || []);
        else console.error('Error fetching todos:', error);
        setLoading(false);
    };

    useEffect(() => {
        fetchTodos();
    }, [user, revision]);

    const toggleTodo = async (id) => {
        if (!user) return;
        const todo = todos.find(t => t.id === id);
        if (!todo) return;

        const newCompleted = !todo.completed;
        setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: newCompleted } : t));

        const { error } = await supabase
            .from('todos')
            .update({ completed: newCompleted })
            .eq('id', id)
            .eq('user_id', user.id); // Security: ensure ownership

        if (error) {
            console.error('Error toggling todo:', error);
            fetchTodos();
        }
    };

    const addTodo = async (text) => {
        if (!text.trim() || !user) return;

        const tempId = Date.now();
        const newTodo = { id: tempId, text, completed: false, user_id: user.id };
        setTodos(prev => [...prev, newTodo]);

        const { data, error } = await supabase
            .from('todos')
            .insert([{ text, completed: false, user_id: user.id }])
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
        if (!user) return;
        setTodos(prev => prev.filter(t => t.id !== id));
        await supabase.from('todos').delete().eq('id', id).eq('user_id', user.id);
    };

    return { todos, toggleTodo, addTodo, deleteTodo, loading };
};
