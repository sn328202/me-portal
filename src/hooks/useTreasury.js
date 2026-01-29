import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useTreasury = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('treasury_items')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error('Error fetching treasury items:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addItem = async (item) => {
        try {
            const { data, error } = await supabase
                .from('treasury_items')
                .insert([{
                    title: item.title,
                    category: item.category,
                    price: item.price,
                    link: item.link,
                    priority: item.priority,
                    image_url: item.image_url,
                    status: 'desired'
                }])
                .select()
                .single();

            if (error) throw error;
            setItems(prev => [data, ...prev]);
            return data;
        } catch (err) {
            console.error('Error adding treasury item:', err);
            throw err;
        }
    };

    const updateItem = async (updatedItem) => {
        try {
            const { error } = await supabase
                .from('treasury_items')
                .update({
                    title: updatedItem.title,
                    category: updatedItem.category,
                    price: updatedItem.price,
                    link: updatedItem.link,
                    priority: updatedItem.priority,
                    image_url: updatedItem.image_url,
                    status: updatedItem.status
                })
                .eq('id', updatedItem.id);

            if (error) throw error;
            setItems(prev => prev.map(i => i.id === updatedItem.id ? { ...i, ...updatedItem } : i));

        } catch (err) {
            console.error('Error updating treasury item:', err);
            throw err;
        }
    };

    const deleteItem = async (id) => {
        try {
            const { error } = await supabase
                .from('treasury_items')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (err) {
            console.error('Error deleting treasury item:', err);
            throw err;
        }
    };

    return {
        items,
        loading,
        error,
        addItem,
        updateItem,
        deleteItem
    };
};
