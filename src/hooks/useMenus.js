import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { replanFor } from '../../api/_cookPlan.js';

/**
 * One row of a menu, whether it is cooked or bought.
 *
 * A course can hold the Diet Coke and the Whole Foods cookies as readily as it
 * holds a recipe: same table, same ordering, recipe_id simply null and a name
 * in its place. Anything with neither is dropped rather than saved as a blank
 * line on a menu.
 */
const entryRow = (mr, index, menuId, userId) => ({
    menu_id: menuId,
    recipe_id: mr.recipe_id || null,
    item_name: mr.recipe_id ? null : (mr.item_name || '').trim() || null,
    item_note: mr.recipe_id ? null : (mr.item_note || '').trim() || null,
    course_name: mr.course_name || 'Main Course',
    order_index: mr.order_index ?? index,
    user_id: userId,
});

export const useMenus = () => {
    const { user } = useAuth();
    const [menus, setMenus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        fetchMenus();
    }, [user]);

    const fetchMenus = async () => {
        try {
            setLoading(true);
            if (!user) {
                setMenus([]);
                return;
            }

            const { data, error } = await supabase
                .from('user_larder_menus')
                /* Only what a menu card and the builder draw. `recipes (*)`
                   dragged every dish's whole method through here, once per
                   menu that mentions it, for a list that shows a title and a
                   thumbnail. Anything needing the full recipe — the printed
                   menu, the cooking schedule — already has the recipe list or
                   re-reads it on the server. */
                .select(`
                    *,
                    user_larder_menu_recipes (
                        *,
                        recipes (id, title, image_url)
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMenus(data || []);
        } catch (err) {
            console.error('Error fetching menus:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addMenu = async (menu, menuRecipes) => {
        try {
            if (!user) throw new Error("Not authenticated");

            // 1. Insert Menu
            const { data: menuData, error: menuError } = await supabase
                .from('user_larder_menus')
                .insert([{
                    title: menu.title,
                    occasion: menu.occasion,
                    notes: menu.notes,
                    user_id: user.id
                }])
                .select()
                .single();

            if (menuError) throw menuError;

            // 2. Insert Menu Recipes
            if (menuRecipes && menuRecipes.length > 0) {
                const recipesToInsert = menuRecipes.map((mr, index) => entryRow(mr, index, menuData.id, user.id));

                const { error: mrError } = await supabase
                    .from('user_larder_menu_recipes')
                    .insert(recipesToInsert);

                if (mrError) throw mrError;
            }

            fetchMenus();
            return menuData;
        } catch (err) {
            console.error('Error adding menu:', err);
            setNotice("Couldn't save that menu. Try again.");
            throw err;
        }
    };

    const deleteMenu = async (id) => {
        try {
            if (!user) return;
            const { error } = await supabase
                .from('user_larder_menus')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;
            setMenus(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            console.error('Error deleting menu:', err);
            setNotice("Couldn't delete that menu. Try again.");
        }
    };

    const updateMenu = async (id, menu, menuRecipes) => {
        try {
            if (!user) return;

            // 1. Update Menu Metadata
            const { error: menuError } = await supabase
                .from('user_larder_menus')
                .update({
                    title: menu.title,
                    occasion: menu.occasion,
                    notes: menu.notes
                })
                .eq('id', id)
                .eq('user_id', user.id);

            if (menuError) throw menuError;

            /* 2. Sync the dishes: delete, then re-insert.
               The delete lands first, so if the insert fails the menu is empty
               in the database while the page still shows every dish — which is
               why the catch below refetches rather than only complaining. The
               owner filter is the one this table was missing; RLS was doing
               the work alone. */
            const { error: deleteError } = await supabase
                .from('user_larder_menu_recipes')
                .delete()
                .eq('menu_id', id)
                .eq('user_id', user.id);

            if (deleteError) throw deleteError;

            if (menuRecipes && menuRecipes.length > 0) {
                const recipesToInsert = menuRecipes.map((mr, index) => entryRow(mr, index, id, user.id));

                const { error: mrError } = await supabase
                    .from('user_larder_menu_recipes')
                    .insert(recipesToInsert);

                if (mrError) throw mrError;
            }

            fetchMenus();
        } catch (err) {
            console.error('Error updating menu:', err);
            setNotice("Couldn't save that menu — reopen it and check the dishes are all still there.");
            // The old rows may already be gone. Put the page back in step with
            // what actually survived rather than leaving it showing a menu
            // that no longer exists.
            fetchMenus();
            throw err;
        }
    };

    /**
     * When it is being served.
     *
     * A plan that has already been built moves with it rather than going
     * stale: every step keeps its distance from the food going out, and the
     * clocks are worked out again. Moving dinner an hour earlier should not
     * mean asking for the whole plan a second time.
     */
    const setServeTime = async (id, { serve_date: serveDate, serve_time: serveTime }) => {
        if (!user) return null;
        const menu = menus.find((m) => m.id === id);
        const plan = replanFor(menu?.plan, { serve_date: serveDate, serve_time: serveTime });

        const patch = { serve_date: serveDate || null, serve_time: serveTime || null, plan: plan || null };
        const { error: saveError } = await supabase
            .from('user_larder_menus')
            .update(patch)
            .eq('id', id)
            .eq('user_id', user.id);

        if (saveError) throw saveError;
        setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
        return plan;
    };

    /** The plan itself — built, edited, or ticked off a step at a time. */
    const savePlan = async (id, plan) => {
        if (!user) return;
        const { error: saveError } = await supabase
            .from('user_larder_menus')
            .update({ plan: plan || null })
            .eq('id', id)
            .eq('user_id', user.id);

        if (saveError) throw saveError;
        setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, plan: plan || null } : m)));
    };

    return {
        menus,
        loading,
        error,
        notice,
        clearNotice: () => setNotice(null),
        addMenu,
        updateMenu,
        deleteMenu,
        setServeTime,
        savePlan,
        refreshMenus: fetchMenus
    };
};
