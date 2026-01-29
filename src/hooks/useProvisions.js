import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useProvisions = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchItems = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('provisions')
            .select('*')
            .order('id', { ascending: true });

        if (!error) setItems(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const toggleItem = async (id) => {
        const item = items.find(i => i.id === id);
        if (!item) return;

        const newChecked = !item.checked;
        setItems(prev => prev.map(i => i.id === id ? { ...i, checked: newChecked } : i));

        const { error } = await supabase
            .from('provisions')
            .update({ checked: newChecked })
            .eq('id', id);

        if (error) fetchItems();
    };

    const addItem = async (text) => {
        if (!text.trim()) return;

        // Optimistic
        const tempId = Date.now();
        const newItem = { id: tempId, text, checked: false };
        setItems(prev => [...prev, newItem]);

        const { data, error } = await supabase
            .from('provisions')
            .insert([{ text, checked: false }])
            .select()
            .single();

        if (error) {
            console.error('Error adding provision:', error);
            setItems(prev => prev.filter(i => i.id !== tempId));
        } else {
            setItems(prev => prev.map(i => i.id === tempId ? data : i));
        }
    };

    const deleteItem = async (id) => {
        setItems(prev => prev.filter(i => i.id !== id));
        await supabase.from('provisions').delete().eq('id', id);
    };

    const clearChecked = async () => {
        const checkedIds = items.filter(i => i.checked).map(i => i.id);
        setItems(prev => prev.filter(i => !i.checked));

        if (checkedIds.length > 0) {
            await supabase.from('provisions').delete().in('id', checkedIds);
        }
    };

    return { items, toggleItem, addItem, deleteItem, clearChecked, loading };
};
