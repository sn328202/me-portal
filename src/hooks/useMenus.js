import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useMenus = () => {
    const { user } = useAuth();
    const [menus, setMenus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                .select(`
                    *,
                    user_larder_menu_recipes (
                        *,
                        recipes (*)
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
                const recipesToInsert = menuRecipes.map((mr, index) => ({
                    menu_id: menuData.id,
                    recipe_id: mr.recipe_id,
                    course_name: mr.course_name || 'Main Course',
                    order_index: mr.order_index ?? index,
                    user_id: user.id
                }));

                const { error: mrError } = await supabase
                    .from('user_larder_menu_recipes')
                    .insert(recipesToInsert);

                if (mrError) throw mrError;
            }

            fetchMenus();
            return menuData;
        } catch (err) {
            console.error('Error adding menu:', err);
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

            // 2. Sync Recipes (Delete then re-insert for simplicity)
            const { error: deleteError } = await supabase
                .from('user_larder_menu_recipes')
                .delete()
                .eq('menu_id', id);

            if (deleteError) throw deleteError;

            if (menuRecipes && menuRecipes.length > 0) {
                const recipesToInsert = menuRecipes.map((mr, index) => ({
                    menu_id: id,
                    recipe_id: mr.recipe_id,
                    course_name: mr.course_name || 'Main Course',
                    order_index: mr.order_index ?? index,
                    user_id: user.id
                }));

                const { error: mrError } = await supabase
                    .from('user_larder_menu_recipes')
                    .insert(recipesToInsert);

                if (mrError) throw mrError;
            }

            fetchMenus();
        } catch (err) {
            console.error('Error updating menu:', err);
            throw err;
        }
    };

    return {
        menus,
        loading,
        error,
        addMenu,
        updateMenu,
        deleteMenu,
        refreshMenus: fetchMenus
    };
};
