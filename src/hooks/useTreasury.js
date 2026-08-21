import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCaptureRevision } from '../contexts/CaptureContext';

export const useTreasury = () => {
    const { user } = useAuth();
    // Refetch when a quick capture writes to this table.
    const revision = useCaptureRevision();
    const [items, setItems] = useState([]);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchItems = async () => {
        try {
            setLoading(true);
            if (!user) {
                setItems([]);
                return;
            }

            const { data, error } = await supabase
                .from('treasury_items')
                .select('*')
                .eq('user_id', user.id)
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

    const fetchBrands = async () => {
        try {
            if (!user) {
                setBrands([]);
                return;
            }

            const { data, error } = await supabase
                .from('treasury_brands')
                .select('*')
                .eq('user_id', user.id)
                .order('name', { ascending: true });

            if (error) throw error;
            setBrands(data || []);
        } catch (err) {
            console.error('Error fetching brands:', err);
        }
    };

    useEffect(() => {
        fetchItems();
        fetchBrands();
    }, [user, revision]);

    /** "$1,299.00" -> 1299. Null for anything that is not a number. */
    const numericPrice = (raw) => {
        if (raw === null || raw === undefined || raw === '') return null;
        const n = Number.parseFloat(String(raw).replace(/[^\d.]/g, ''));
        return Number.isFinite(n) ? n : null;
    };

    const addItem = async (item) => {
        try {
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('treasury_items')
                .insert([{
                    title: item.title,
                    category: item.category,
                    price: item.price,
                    link: item.link,
                    priority: item.priority,
                    image_url: item.image_url,
                    description: item.description || null,
                    brand: item.brand || null,
                    // Numeric copy of `price` so price history has something
                    // comparable to chart. `price` itself stays free text.
                    price_amount: numericPrice(item.price),
                    price_currency: item.price_currency || (item.price ? 'USD' : null),
                    status: 'desired',
                    user_id: user.id
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

    const addBrand = async (brand) => {
        try {
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('treasury_brands')
                .insert([{
                    name: brand.name,
                    link: brand.link,
                    tags: brand.tags,
                    notes: brand.notes,
                    image_url: brand.image_url,
                    user_id: user.id
                }])
                .select()
                .single();

            if (error) throw error;
            setBrands(prev => [...prev, data].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            return data;
        } catch (err) {
            console.error('Error adding brand:', err);
            throw err;
        }
    };

    const updateItem = async (updatedItem) => {
        try {
            if (!user) throw new Error('Not authenticated');
            const { error } = await supabase
                .from('treasury_items')
                .update({
                    title: updatedItem.title,
                    category: updatedItem.category,
                    price: updatedItem.price,
                    link: updatedItem.link,
                    priority: updatedItem.priority,
                    image_url: updatedItem.image_url,
                    description: updatedItem.description || null,
                    brand: updatedItem.brand || null,
                    price_amount: numericPrice(updatedItem.price),
                    price_currency: updatedItem.price_currency || (updatedItem.price ? 'USD' : null),
                    status: updatedItem.status
                })
                .eq('id', updatedItem.id)
                .eq('user_id', user.id);

            if (error) throw error;
            setItems(prev => prev.map(i => i.id === updatedItem.id ? { ...i, ...updatedItem } : i));

        } catch (err) {
            console.error('Error updating treasury item:', err);
            throw err;
        }
    };

    const deleteItem = async (id) => {
        try {
            if (!user) throw new Error('Not authenticated');
            const { error } = await supabase
                .from('treasury_items')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (err) {
            console.error('Error deleting treasury item:', err);
            throw err;
        }
    };

    const deleteBrand = async (id) => {
        try {
            if (!user) throw new Error('Not authenticated');
            const { error } = await supabase
                .from('treasury_brands')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;
            setBrands(prev => prev.filter(b => b.id !== id));
        } catch (err) {
            console.error('Error deleting brand:', err);
            throw err;
        }
    };

    return {
        items,
        brands,
        loading,
        error,
        addItem,
        updateItem,
        deleteItem,
        addBrand,
        deleteBrand
    };
};
