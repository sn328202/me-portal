import { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { buildMatcher, normalise, guessCategory, iconFor, labelFor } from '../utils/ingredientMatch';

/**
 * The pantry: one copy of it, for the whole app.
 *
 * This used to be an ordinary hook, and the Hearth tab mounted it twice — once
 * on the Larder page and once inside the shopping list living on that same
 * page. Two fetches, two realtime channels on the same topic, two matchers
 * built over the same rows, and, worse than any of the waste, **two different
 * answers**: ticking something off the shopping list marked it in stock in the
 * list's copy while the page's copy — the one deciding every recipe's pantry
 * percentage — went on saying she did not have it.
 *
 * So the store is mounted once, by `PantryProvider`, and `useIngredients()`
 * reads it from context. Every caller keeps the shape it already had.
 *
 * Two other things follow from being mounted once:
 *
 * The actions are stable across renders. They read the current rows from a ref
 * rather than from the closure they were created in, which is what lets the
 * pantry list memoise its 260 rows — and also closes a real bug, where two
 * aliases taught in quick succession both wrote an array built from the same
 * pre-write snapshot and the first one was lost.
 *
 * And the realtime channel applies what it is told instead of re-reading the
 * whole table. Every write here is already optimistic, so the echo of the
 * app's own write used to cost a 260-row download, a new array identity, a
 * matcher rebuild and a re-render of every recipe card — for a row it already
 * had right.
 */

const PantryContext = createContext(null);

/** Whether a row from the server says anything the local copy does not. */
const differs = (mine, theirs) => {
    if (!mine) return true;
    return JSON.stringify({ ...mine, ...theirs }) !== JSON.stringify(mine);
};

export const usePantryStore = () => {
    const { user } = useAuth();
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    /* What the rows are right now, readable from an action without making that
       action depend on them. Assigned during render on purpose: an effect
       would leave it a render behind, and a stale pantry is how an alias gets
       written back over the top of another one. */
    const rowsRef = useRef(ingredients);
    rowsRef.current = ingredients;

    const fetchIngredients = useCallback(async () => {
        try {
            setLoading(true);
            if (!user) {
                setIngredients([]);
                return;
            }

            const { data, error: readError } = await supabase
                .from('pantry_ingredients')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_deleted', false) // Soft delete check
                .order('label', { ascending: true });

            if (readError) throw readError;
            setIngredients(data || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching ingredients:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

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
                    /* Apply the row, do not re-read the table. This channel
                       hears the app's own writes back, and those are already
                       on screen — refetching for them was 260 rows and a
                       matcher rebuild to learn nothing. */
                    const row = payload.new;
                    const gone = payload.eventType === 'DELETE' || row?.is_deleted;

                    setIngredients((prev) => {
                        if (gone) {
                            const id = row?.id || payload.old?.id;
                            return prev.some((i) => i.id === id)
                                ? prev.filter((i) => i.id !== id)
                                : prev;
                        }
                        if (!row?.id) return prev;

                        const mine = prev.find((i) => i.id === row.id);
                        if (mine) {
                            // Nothing new in it: keep the array we have, so
                            // nothing downstream recomputes.
                            if (!differs(mine, row)) return prev;
                            return prev.map((i) => (i.id === row.id ? { ...i, ...row } : i));
                        }
                        return [...prev, row];
                    });
                })
                .subscribe();
        }

        return () => {
            if (subscription) supabase.removeChannel(subscription);
        };
    }, [user, fetchIngredients]);

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
    const addCustomIngredient = useCallback(async (key, data) => {
        try {
            // Check locally first to avoid duplicate calls
            const known = rowsRef.current.some((i) => (
                (i.name || i.label || '').toLowerCase() === String(key || '').toLowerCase()
                || (data.label && (i.name || i.label || '').toLowerCase() === data.label.toLowerCase())
            ));
            if (known) return;

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

            const { data: inserted, error: writeError } = await supabase
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

            if (writeError) {
                // Rollback
                setIngredients(prev => prev.filter(i => i.id !== optimisticId));
                throw writeError;
            }

            // Replace temp item with real one
            setIngredients(prev => prev.map(i => i.id === optimisticId ? inserted : i));
            return inserted;
        } catch (err) {
            console.error("Error adding ingredient:", err);
            setError(`Couldn't add ${data?.label || 'that ingredient'} to your pantry. Try again.`);
            return null;
        }
    }, [user]);

    /**
     * Strip a wording from every ingredient except one.
     *
     * A phrase means exactly one thing. Without this, re-linking a line only
     * *added* the wording to the new ingredient and left it on the old one, so
     * "goat cheese" could mean both cottage cheese and goat cheese at once, and
     * which one won came down to index order rather than to what she said.
     */
    const claimAlias = useCallback(async (alias, keeperId) => {
        const stale = rowsRef.current.filter(
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
    }, [user]);

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
    const addManyIngredients = useCallback(async (entries = []) => {
        if (!user || !entries.length) return { added: 0 };

        // Two lines of the same recipe often name the same thing ("cilantro,
        // chopped" and "cilantro, to garnish"), so collapse before inserting.
        const seen = new Set(rowsRef.current.map((i) => (i.name || i.label || '').toLowerCase()));
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

        const { data, error: writeError } = await supabase.from('pantry_ingredients').insert(rows).select();
        if (writeError) {
            setIngredients((prev) => prev.filter((i) => !String(i.id).startsWith('temp-')));
            console.error('Error bulk-adding ingredients:', writeError);
            return { added: 0, error: "Couldn't add those to your pantry. Try again." };
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
    }, [user, claimAlias]);

    /**
     * Teach an ingredient another name for itself.
     *
     * The alias is stored normalised, because that is the form the matcher
     * compares against — normalising on every read would be per-render work
     * for a value that never changes.
     *
     * The row is read back out of the ref *after* the await, not from the
     * closure this call was created in. Teaching two names in quick succession
     * used to build both new arrays from the same pre-write snapshot, and the
     * second write dropped the first name on the floor.
     */
    const addAlias = useCallback(async (id, phrase) => {
        if (!user) return;
        const alias = normalise(phrase).text;
        if (!alias) return;

        // Whoever held this wording before does not hold it any more.
        await claimAlias(alias, id);

        const ing = rowsRef.current.find((i) => i.id === id);
        if (!ing || (ing.aliases || []).includes(alias)) return;

        const before = ing.aliases || [];
        const next = [...before, alias];
        setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, aliases: next } : i)));

        const { error: writeError } = await supabase
            .from('pantry_ingredients')
            .update({ aliases: next })
            .eq('id', id)
            .eq('user_id', user.id);

        if (writeError) {
            setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, aliases: before } : i)));
            console.error('Error adding alias:', writeError);
            setError("Couldn't save that name. Try again.");
        }
    }, [user, claimAlias]);

    const removeAlias = useCallback(async (id, alias) => {
        if (!user) return;
        const ing = rowsRef.current.find((i) => i.id === id);
        if (!ing) return;
        const before = ing.aliases || [];
        const next = before.filter((a) => a !== alias);

        setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, aliases: next } : i)));
        const { error: writeError } = await supabase
            .from('pantry_ingredients')
            .update({ aliases: next })
            .eq('id', id)
            .eq('user_id', user.id);
        if (writeError) {
            setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, aliases: before } : i)));
            setError("Couldn't remove that name. Try again.");
        }
    }, [user]);

    /**
     * Change a field on an ingredient - its symbol, its label, where it is
     * filed. Optimistic, and rolls the row back to exactly what it was rather
     * than refetching, so an edit that fails does not also blank the pantry.
     */
    const updateIngredient = useCallback(async (id, patch) => {
        if (!user || !patch) return;
        const before = rowsRef.current.find((i) => i.id === id);
        if (!before) return;

        setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

        const { error: writeError } = await supabase
            .from('pantry_ingredients')
            .update(patch)
            .eq('id', id)
            .eq('user_id', user.id);

        if (writeError) {
            setIngredients((prev) => prev.map((i) => (i.id === id ? before : i)));
            console.error('Error updating ingredient:', writeError);
            setError(`Couldn't save the change to ${before.label || before.name}. Try again.`);
        }
    }, [user]);

    const deleteIngredient = useCallback(async (id) => {
        if (!user) return;
        const before = rowsRef.current.find((i) => i.id === id);
        // Optimistic Delete
        setIngredients(prev => prev.filter(i => i.id !== id));

        const { error: writeError } = await supabase
            .from('pantry_ingredients')
            .update({ is_deleted: true })
            .eq('id', id)
            .eq('user_id', user.id);

        if (writeError) {
            // Put it back rather than blanking the pantry with a refetch.
            if (before) setIngredients((prev) => [...prev, before]);
            console.error("Error deleting ingredient:", writeError);
            setError(`Couldn't delete ${before?.label || 'that'}. Try again.`);
        }
    }, [user]);

    const togglePantryStock = useCallback(async (id) => {
        if (!user) return;
        const ing = rowsRef.current.find(i => i.id === id);
        if (!ing) return;

        // Optimistic Toggle
        const newStatus = !ing.in_stock;
        setIngredients(prev => prev.map(i => i.id === id ? { ...i, in_stock: newStatus } : i));

        const { error: writeError } = await supabase
            .from('pantry_ingredients')
            .update({ in_stock: newStatus })
            .eq('id', id)
            .eq('user_id', user.id);

        if (writeError) {
            // Rollback
            setIngredients(prev => prev.map(i => i.id === id ? { ...i, in_stock: !newStatus } : i));
            console.error("Error toggling stock:", writeError);
            setError(`Couldn't update ${ing.label || ing.name}. Try again.`);
        }
    }, [user]);

    /** Say the last failure once, and let the page clear it. */
    const clearError = useCallback(() => setError(null), []);

    return useMemo(() => ({
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
        refreshIngredients: fetchIngredients,
        clearError,
        loading,
        error
    }), [
        ingredients, allIngredients, ingredientsByName, ingredientsByCategory, pantryStock, matcher,
        addCustomIngredient, addManyIngredients, addAlias, removeAlias, updateIngredient,
        deleteIngredient, togglePantryStock, fetchIngredients, clearError, loading, error,
    ]);
};

export { PantryContext };

/**
 * The pantry as every screen sees it. One store, read from context — see the
 * note at the top of this file for what having two of them cost.
 */
export const useIngredients = () => {
    const store = useContext(PantryContext);
    if (!store) {
        throw new Error('useIngredients() needs a <PantryProvider> above it.');
    }
    return store;
};
