import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCaptureRevision } from '../contexts/CaptureContext';

export const useProvisions = () => {
    const { user } = useAuth();
    // Refetch when a quick capture writes to this table.
    const revision = useCaptureRevision();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchItems = async () => {
        if (!user) {
            setItems([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data, error } = await supabase
            .from('provisions')
            .select('*')
            .eq('user_id', user.id)
            .order('id', { ascending: true });

        if (!error) setItems(data || []);
        else console.error('Error fetching provisions:', error);
        setLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, [user, revision]);

    const toggleItem = async (id) => {
        if (!user) return;
        const item = items.find(i => i.id === id);
        if (!item) return;

        const newChecked = !item.checked;
        setItems(prev => prev.map(i => i.id === id ? { ...i, checked: newChecked } : i));

        const { error } = await supabase
            .from('provisions')
            .update({ checked: newChecked })
            .eq('id', id)
            .eq('user_id', user.id); // Security: Ensure ownership

        if (error) {
            console.error('Error toggling item:', error);
            fetchItems();
        }
    };

    const addItem = async (text) => {
        if (!text.trim() || !user) return;

        // Optimistic
        const tempId = Date.now();
        const newItem = { id: tempId, text, checked: false, user_id: user.id };
        setItems(prev => [...prev, newItem]);

        const { data, error } = await supabase
            .from('provisions')
            .insert([{ text, checked: false, user_id: user.id }])
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
        if (!user) return;
        setItems(prev => prev.filter(i => i.id !== id));
        await supabase.from('provisions').delete().eq('id', id).eq('user_id', user.id);
    };

    const clearChecked = async () => {
        if (!user) return;
        const checkedIds = items.filter(i => i.checked).map(i => i.id);
        setItems(prev => prev.filter(i => !i.checked));

        if (checkedIds.length > 0) {
            await supabase.from('provisions').delete().in('id', checkedIds).eq('user_id', user.id);
        }
    };

    return { items, toggleItem, addItem, deleteItem, clearChecked, loading };
};
