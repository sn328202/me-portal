import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useIngredients = () => {
    const { user } = useAuth();
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch Ingredients
    useEffect(() => {
        fetchIngredients();

        let subscription;
        if (user) {
            subscription = supabase
                .channel(`public:pantry_ingredients:${user.id}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'pantry_ingredients',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    fetchIngredients();
                })
                .subscribe();
        }

        return () => {
            if (subscription) supabase.removeChannel(subscription);
        };
    }, [user]);

    const fetchIngredients = async () => {
        try {
            setLoading(true);
            if (!user) {
                setIngredients([]);
                return;
            }

            const { data, error } = await supabase
                .from('pantry_ingredients')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_deleted', false) // Soft delete check
                .order('label', { ascending: true });

            if (error) throw error;
            setIngredients(data || []);
        } catch (err) {
            console.error('Error fetching ingredients:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Derived State for UI Compatibility
    const pantryStock = useMemo(() => {
        const stock = {};
        ingredients.forEach(ing => {
            if (ing.in_stock) stock[ing.id] = true;
        });
        return stock;
    }, [ingredients]);

    const ingredientsByCategory = useMemo(() => {
        return ingredients.reduce((acc, ing) => {
            const cat = ing.category || 'Uncategorized';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(ing);
            return acc;
        }, {});
    }, [ingredients]);

    // Lookup Map for "Check by Name" (case insensitive)
    // Key = lowercase name, Value = Ingredient Object
    const ingredientsByName = useMemo(() => {
        const map = {};
        ingredients.forEach(ing => {
            if (ing.name) map[ing.name.toLowerCase()] = ing;
            // Also map label if name is missing?
            else if (ing.label) map[ing.label.toLowerCase()] = ing;
        });
        return map;
    }, [ingredients]);

    // Legacy AllIngredients (ID keyed)
    const allIngredients = useMemo(() => {
        const map = {};
        ingredients.forEach(ing => {
            map[ing.id] = ing;
        });
        return map;
    }, [ingredients]);

    // Actions
    const addCustomIngredient = async (key, data) => {
        try {
            // Check locally first to avoid duplicate calls
            if (ingredientsByName[key] || ingredientsByName[data.label?.toLowerCase()]) return;

            if (!user) throw new Error("Not authenticated");

            // Optimistic Add
            const optimisticId = 'temp-' + Date.now();
            const newItem = {
                id: optimisticId,
                name: key,
                label: data.label,
                icon: data.icon,
                category: data.category,
                default_unit: data.defaultUnit,
                in_stock: false, // Default to OUT of stock
                is_deleted: false,
                user_id: user.id
            };

            setIngredients(prev => [...prev, newItem]);

            const { data: inserted, error } = await supabase
                .from('pantry_ingredients')
                .insert([{
                    name: key,
                    label: data.label,
                    icon: data.icon,
                    category: data.category,
                    default_unit: data.defaultUnit,
                    in_stock: false, // Default to OUT of stock per user request
                    user_id: user.id
                }])
                .select()
                .single();

            if (error) {
                // Rollback
                setIngredients(prev => prev.filter(i => i.id !== optimisticId));
                throw error;
            }

            // Replace temp item with real one
            setIngredients(prev => prev.map(i => i.id === optimisticId ? inserted : i));

        } catch (err) {
            console.error("Error adding ingredient:", err);
            // alert("Could not add ingredient: " + err.message);
        }
    };

    const deleteIngredient = async (id) => {
        if (!user) return;
        // Optimistic Delete
        setIngredients(prev => prev.filter(i => i.id !== id));

        try {
            const { error } = await supabase
                .from('pantry_ingredients')
                .update({ is_deleted: true })
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) {
                // Fetch to restore if failed
                fetchIngredients();
                throw error;
            }
        } catch (err) {
            console.error("Error deleting ingredient:", err);
        }
    };

    const togglePantryStock = async (id) => {
        if (!user) return;
        // Find current status
        const ing = ingredients.find(i => i.id === id);
        if (!ing) return;

        // Optimistic Toggle
        const newStatus = !ing.in_stock;
        setIngredients(prev => prev.map(i => i.id === id ? { ...i, in_stock: newStatus } : i));

        try {
            const { error } = await supabase
                .from('pantry_ingredients')
                .update({ in_stock: newStatus })
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) {
                // Rollback
                setIngredients(prev => prev.map(i => i.id === id ? { ...i, in_stock: !newStatus } : i));
                throw error;
            }
        } catch (err) {
            console.error("Error toggling stock:", err);
        }
    };

    return {
        allIngredients, // Keyed by ID
        ingredientsByName, // New: Keyed by Name (for existence checks)
        ingredientsByCategory,
        pantryStock,
        addCustomIngredient,
        deleteIngredient,
        togglePantryStock,
        loading,
        error
    };
};
