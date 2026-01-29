import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useLibrary = () => {
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
                .from('library_items')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error('Error fetching library items:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addItem = async (item) => {
        try {
            const { data, error } = await supabase
                .from('library_items')
                .insert([{
                    title: item.title,
                    creator: item.creator,
                    type: item.type,
                    status: item.status || 'Not Started',
                    rating: item.rating,
                    review: item.review,
                    image_url: item.image_url,
                    link: item.link
                }])
                .select()
                .single();

            if (error) throw error;
            setItems(prev => [data, ...prev]);
            return data;
        } catch (err) {
            console.error('Error adding library item:', err);
            throw err;
        }
    };

    const updateItem = async (updatedItem) => {
        try {
            const { error } = await supabase
                .from('library_items')
                .update({
                    title: updatedItem.title,
                    creator: updatedItem.creator,
                    type: updatedItem.type,
                    status: updatedItem.status,
                    rating: updatedItem.rating,
                    review: updatedItem.review,
                    image_url: updatedItem.image_url,
                    link: updatedItem.link
                })
                .eq('id', updatedItem.id);

            if (error) throw error;
            setItems(prev => prev.map(i => i.id === updatedItem.id ? { ...i, ...updatedItem } : i));
        } catch (err) {
            console.error('Error updating library item:', err);
            throw err;
        }
    };

    const deleteItem = async (id) => {
        try {
            const { error } = await supabase
                .from('library_items')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (err) {
            console.error('Error deleting library item:', err);
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
