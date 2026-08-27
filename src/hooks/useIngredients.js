import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { buildMatcher, normalise, guessCategory, iconFor, labelFor } from '../utils/ingredientMatch';

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

    /**
     * The matcher, rebuilt only when the pantry actually changes.
     *
     * This replaces the `ingredientsByName[name.toLowerCase()]` lookup that
     * four different components each did for themselves. That lookup found a
     * pantry row only when a recipe named it character for character, so
     * "1 bay leaf" missed `bay leaf` and nothing ever matched an ingredient
     * written the way a person writes one.
     */
    const matcher = useMemo(() => buildMatcher(ingredients), [ingredients]);

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

    /**
     * Add several ingredients at once — the recipe's misses, in one go.
     *
     * Written as a single insert rather than a loop of addCustomIngredient
     * calls: thirty round trips is thirty chances for one to fail halfway and
     * leave the pantry half-filled.
     *
     * Rows land out of stock, matching the single-add flow: having a recipe
     * tell the pantry what she owns would be worse than useless.
     */
    const addManyIngredients = async (entries = []) => {
        if (!user || !entries.length) return { added: 0 };

        // Two lines of the same recipe often name the same thing ("cilantro,
        // chopped" and "cilantro, to garnish"), so collapse before inserting.
        const seen = new Set(Object.keys(ingredientsByName));
        const rows = [];
        for (const entry of entries) {
            // Accepts a reviewed row, or a bare string for the callers that
            // have nothing to review (linking offers a one-line create).
            const line = typeof entry === 'string' ? { raw: entry } : entry;
            const name = normalise(line.raw).text;
            if (!name || seen.has(name)) continue;
            seen.add(name);
            const category = line.category || guessCategory(line.raw);
            rows.push({
                user_id: user.id,
                name,
                label: line.label || labelFor(line.raw),
                category,
                icon: line.icon || iconFor(category),
                default_unit: 'pcs',
                in_stock: false,
            });
        }

        if (!rows.length) return { added: 0 };

        const optimistic = rows.map((r, i) => ({ ...r, id: `temp-${Date.now()}-${i}`, is_deleted: false }));
        setIngredients((prev) => [...prev, ...optimistic]);

        const { data, error } = await supabase.from('pantry_ingredients').insert(rows).select();
        if (error) {
            setIngredients((prev) => prev.filter((i) => !String(i.id).startsWith('temp-')));
            console.error('Error bulk-adding ingredients:', error);
            return { added: 0, error: error.message };
        }

        setIngredients((prev) => [
            ...prev.filter((i) => !String(i.id).startsWith('temp-')),
            ...(data || []),
        ]);

        // A brand new `goat cheese` row takes that wording back from whatever
        // had been standing in for it - otherwise the old ingredient keeps
        // claiming a name it was only ever borrowing.
        await Promise.all((data || []).map((row) => claimAlias(row.name, row.id)));

        return { added: (data || []).length, created: data || [] };
    };

    /**
     * Teach an ingredient another name for itself.
     *
     * The alias is stored normalised, because that is the form the matcher
     * compares against — normalising on every read would be per-render work
     * for a value that never changes.
     */
    /**
     * Strip a wording from every ingredient except one.
     *
     * A phrase means exactly one thing. Without this, re-linking a line only
     * *added* the wording to the new ingredient and left it on the old one, so
     * "goat cheese" could mean both cottage cheese and goat cheese at once, and
     * which one won came down to index order rather than to what she said.
     */
    const claimAlias = async (alias, keeperId) => {
        const stale = ingredients.filter(
            (i) => i.id !== keeperId && (i.aliases || []).includes(alias)
        );
        if (!stale.length) return;

        setIngredients((prev) => prev.map((i) => (
            stale.some((x) => x.id === i.id)
                ? { ...i, aliases: (i.aliases || []).filter((a) => a !== alias) }
                : i
        )));

        await Promise.all(stale.map((i) => supabase
            .from('pantry_ingredients')
            .update({ aliases: (i.aliases || []).filter((a) => a !== alias) })
            .eq('id', i.id)
            .eq('user_id', user.id)));
    };

    const addAlias = async (id, phrase) => {
        if (!user) return;
        const alias = normalise(phrase).text;
        if (!alias) return;

        // Whoever held this wording before does not hold it any more.
        await claimAlias(alias, id);

        const ing = ingredients.find((i) => i.id === id);
        if (!ing || (ing.aliases || []).includes(alias)) return;

        const next = [...(ing.aliases || []), alias];
        setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, aliases: next } : i)));

        const { error } = await supabase
            .from('pantry_ingredients')
            .update({ aliases: next })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, aliases: ing.aliases || [] } : i)));
            console.error('Error adding alias:', error);
        }
    };

    const removeAlias = async (id, alias) => {
        if (!user) return;
        const ing = ingredients.find((i) => i.id === id);
        if (!ing) return;
        const next = (ing.aliases || []).filter((a) => a !== alias);

        setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, aliases: next } : i)));
        const { error } = await supabase
            .from('pantry_ingredients')
            .update({ aliases: next })
            .eq('id', id)
            .eq('user_id', user.id);
        if (error) fetchIngredients();
    };

    /**
     * Change a field on an ingredient - its symbol, its label, where it is
     * filed. Optimistic, and rolls the row back to exactly what it was rather
     * than refetching, so an edit that fails does not also blank the pantry.
     */
    const updateIngredient = async (id, patch) => {
        if (!user || !patch) return;
        const before = ingredients.find((i) => i.id === id);
        if (!before) return;

        setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

        const { error } = await supabase
            .from('pantry_ingredients')
            .update(patch)
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            setIngredients((prev) => prev.map((i) => (i.id === id ? before : i)));
            console.error('Error updating ingredient:', error);
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
        ingredients,
        allIngredients, // Keyed by ID
        ingredientsByName, // New: Keyed by Name (for existence checks)
        ingredientsByCategory,
        pantryStock,
        matcher,
        addCustomIngredient,
        addManyIngredients,
        addAlias,
        removeAlias,
        updateIngredient,
        deleteIngredient,
        togglePantryStock,
        loading,
        error
    };
};
