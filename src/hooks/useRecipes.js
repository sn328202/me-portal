import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useRecipes = () => {
    const { user } = useAuth();
    const [recipes, setRecipes] = useState([]);
    const [mealPlan, setMealPlan] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch Recipes
    useEffect(() => {
        fetchRecipes();
        fetchMealPlan();
    }, [user]);

    const fetchRecipes = async () => {
        try {
            setLoading(true);
            if (!user) {
                setRecipes([]);
                return;
            }

            const { data, error } = await supabase
                .from('recipes')
                .select('*, ingredients(*)')
                .eq('user_id', user.id);

            if (error) throw error;
            setRecipes(data || []);
        } catch (err) {
            console.error('Error fetching recipes:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchMealPlan = async () => {
        // Fetch meal plans and transform into { "Monday": [ids], "Tuesday": [ids] }
        try {
            if (!user) {
                setMealPlan({});
                return;
            }

            const { data, error } = await supabase
                .from('meal_plans')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;

            const plan = {};
            data?.forEach(row => {
                if (!plan[row.day_name]) plan[row.day_name] = [];
                plan[row.day_name].push(row.recipe_id);
            });
            setMealPlan(plan);
        } catch (err) {
            console.error('Error fetching meal plan:', err);
        }
    };

    const deleteRecipe = async (id) => {
        try {
            if (!user) return;
            const { error } = await supabase
                .from('recipes')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;
            setRecipes(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error('Error deleting recipe:', err);
        }
    };

    const addToPlan = async (day, recipeId) => {
        try {
            if (!user) return;

            const { error } = await supabase
                .from('meal_plans')
                .insert([{
                    day_name: day,
                    recipe_id: recipeId,
                    date: new Date().toISOString(), // Placeholder date
                    user_id: user.id
                }]);

            if (error) throw error;

            // Optimistic update or Refetch
            fetchMealPlan();
        } catch (err) {
            console.error('Error adding to plan:', err);
        }
    };

    const clearDay = async (day) => {
        try {
            if (!user) return;
            const { error } = await supabase
                .from('meal_plans')
                .delete()
                .eq('day_name', day)
                .eq('user_id', user.id);

            if (error) throw error;

            setMealPlan(prev => {
                const newPlan = { ...prev };
                delete newPlan[day];
                return newPlan;
            });
        } catch (err) {
            console.error('Error clearing day:', err);
        }
    };

    const importRecipe = async (url) => {
        try {
            // Strategy: Try multiple proxies to bypass CORS
            const proxies = [
                { prefix: 'https://api.cors.lol/?url=', type: 'text' },
                { prefix: 'https://api.codetabs.com/v1/proxy?quest=', type: 'text' },
                { prefix: 'https://corsproxy.io/?', type: 'text' },
                { prefix: 'https://api.allorigins.win/get?url=', type: 'json' }
            ];

            let htmlContent = null;
            let lastError = null;

            for (const proxy of proxies) {
                try {
                    console.log(`📡 Recipe Import: Attempting ${proxy.prefix}`);
                    const response = await fetch(`${proxy.prefix}${encodeURIComponent(url)}`);

                    if (!response.ok) {
                        console.warn(`❌ Proxy ${proxy.prefix} rejected request (Status: ${response.status})`);
                        throw new Error(`Status ${response.status}`);
                    }

                    if (proxy.type === 'json') {
                        const data = await response.json();
                        if (data.contents) htmlContent = data.contents;
                    } else {
                        htmlContent = await response.text();
                    }

                    // Validate: Check if we got the proxy's own page instead of the target
                    if (htmlContent && (
                        htmlContent.includes('<title>CorsProxy | Fix CORS Errors') ||
                        htmlContent.includes('CORS Proxy') ||
                        htmlContent.length < 300 // Reduced threshold to avoid false positives but still catch landings
                    )) {
                        console.warn(`⚠️ Proxy ${proxy.prefix} returned landing page instead of content`);
                        throw new Error("Proxy returned its own landing page");
                    }

                    if (htmlContent) {
                        console.log(`✅ Recipe Import: Content retrieved via ${proxy.prefix}`);
                        break; // Success
                    }
                } catch (e) {
                    lastError = e;
                }
            }

            if (!htmlContent) {
                const msg = lastError?.message || 'Connection timeout';
                console.error("🚫 Recipe Import: All proxies failed.", lastError);
                throw new Error(`Could not fetch recipe content. The aether is thick today (Last attempt failed with: ${msg}).`);
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, "text/html");

            // Strategy 1: Look for JSON-LD Recipe Schema
            let recipeData = null;
            const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

            scripts.forEach(script => {
                try {
                    const json = JSON.parse(script.innerText);
                    // Standard schema.org/Recipe
                    if (json['@type'] === 'Recipe') {
                        recipeData = json;
                    }
                    // Graph array support
                    else if (Array.isArray(json['@graph'])) {
                        const found = json['@graph'].find(item => item['@type'] === 'Recipe');
                        if (found) recipeData = found;
                    }
                } catch (e) {
                    // ignore invalid json snippets
                }
            });

            if (recipeData) {
                // Parse Schema Data
                const title = recipeData.name;
                const instructions = Array.isArray(recipeData.recipeInstructions)
                    ? recipeData.recipeInstructions.map(step => step.text || step.name || step).join('\n')
                    : recipeData.recipeInstructions;

                // Extract Metadata
                const image_url = Array.isArray(recipeData.image) ? recipeData.image[0] : (recipeData.image?.url || recipeData.image);
                const servings = Array.isArray(recipeData.recipeYield) ? recipeData.recipeYield[0] : recipeData.recipeYield;

                // Helper to parse ISO 8601 duration (PT1H30M)
                const parseDuration = (iso) => {
                    if (!iso) return '';
                    const match = iso.match(/PT(\d+H)?(\d+M)?/);
                    if (!match) return iso; // Fallback to raw string
                    const hours = match[1] ? match[1].replace('H', 'h ') : '';
                    const minutes = match[2] ? match[2].replace('M', 'm') : '';
                    return (hours + minutes).trim();
                };

                const prep_time = parseDuration(recipeData.prepTime);
                const cook_time = parseDuration(recipeData.cookTime);
                const total_time = parseDuration(recipeData.totalTime);

                // Parse ingredients (array of strings usually)
                const rawIngredients = Array.isArray(recipeData.recipeIngredient)
                    ? recipeData.recipeIngredient
                    : [];

                // Transform string ingredients to object structure { item: "", amount: "", unit: "", notes: "" }
                const COMMON_UNITS = new Set([
                    'cup', 'cups', 'c',
                    'tsp', 'teaspoon', 'teaspoons', 't',
                    'tbsp', 'tablespoon', 'tablespoons', 'T',
                    'oz', 'ounce', 'ounces',
                    'lb', 'lbs', 'pound', 'pounds',
                    'g', 'gram', 'grams',
                    'kg', 'kilogram', 'kilograms',
                    'ml', 'milliliter', 'milliliters',
                    'l', 'liter', 'liters',
                    'qt', 'quart', 'quarts',
                    'pt', 'pint', 'pints',
                    'gal', 'gallon', 'gallons',
                    'pinch', 'pinches',
                    'dash', 'dashes',
                    'sprig', 'sprigs',
                    'slice', 'slices',
                    'clove', 'cloves',
                    'can', 'cans',
                    'bottle', 'bottles',
                    'package', 'packages', 'pkg', 'pkgs',
                    'stick', 'sticks',
                    'piece', 'pieces', 'pcs',
                    'handful', 'handfuls',
                    'head', 'heads',
                    'bunch', 'bunches',
                    'drop', 'drops'
                ]);

                const ingredients = rawIngredients.map(str => {
                    let cleanStr = str.trim();

                    // Regex for Amount:
                    // Matches integers, decimals, fractions (1/2), unicode fractions (½), ranges (1-2)
                    // AND mixed numbers with spaces (1 1/2 or 1 ½)
                    // Logic: Match a number-chunk. Optionally match more number-chunks IF they start with a number/fraction char (not just any char).
                    const numberCharClass = '[0-9\u00BC-\u00BE\u2150-\u215E\/\\.\\-]';
                    // Pattern: (NumberChunk) (Space NumberChunk)*
                    const amountRegex = new RegExp(`^(${numberCharClass}+(\\s+${numberCharClass}+)*)`);

                    const amountMatch = cleanStr.match(amountRegex);

                    let amount = '1';
                    let unit = 'pcs';
                    let rest = cleanStr;

                    if (amountMatch) {
                        amount = amountMatch[0].trim();
                        rest = cleanStr.substring(amountMatch[0].length).trim();

                        // Check for Unit
                        // Look for the first word in the rest of the string
                        const unitMatch = rest.match(/^([a-zA-Z]+)(\.|s)?(\s+|$)/);

                        if (unitMatch) {
                            const potentialUnit = unitMatch[1].toLowerCase();
                            // Check against whitelist to avoid eating legitimate words like "Bird's" or "Large" (unless Large is a unit?)
                            // Note: 'medium' is often a size, not a unit, but usage varies. Let's stick to standard measure units for now.
                            // If it matches a known unit (singular or pluralish), take it.

                            // Simple cleaner for plural 's' checking
                            const baseUnit = potentialUnit.endsWith('s') ? potentialUnit.slice(0, -1) : potentialUnit;

                            if (COMMON_UNITS.has(potentialUnit) || COMMON_UNITS.has(baseUnit) || COMMON_UNITS.has(potentialUnit + 's')) {
                                unit = unitMatch[0].trim(); // Keep original casing/punctuation for display if desired, or normalize
                                rest = rest.substring(unitMatch[0].length).trim();
                            }
                        }
                    }

                    // Parse Notes from Item
                    let item = rest;
                    let notes = '';

                    const parenMatch = rest.match(/(.*?)\s*\((.*?)\)/);
                    if (parenMatch) {
                        item = parenMatch[1];
                        notes = parenMatch[2];
                    } else if (rest.includes(',')) {
                        const split = rest.split(',');
                        item = split[0];
                        notes = split.slice(1).join(',').trim();
                    }

                    // Fail-safe
                    if (!item && !amountMatch) {
                        item = str;
                        amount = '1';
                        unit = 'pcs';
                    }

                    return {
                        amount,
                        unit,
                        item: item.trim(),
                        notes: notes.trim()
                    };
                });

                return {
                    title,
                    instructions,
                    ingredients,
                    image_url,
                    prep_time,
                    cook_time,
                    total_time,
                    servings,
                    source_url: url,
                    tags: ['Imported']
                };
            }

            // Strategy 2: Fallback to Meta Tags
            const ogTitle = doc.querySelector('meta[property="og:title"]')?.content;
            const ogImage = doc.querySelector('meta[property="og:image"]')?.content;

            if (ogTitle) {
                return {
                    title: ogTitle,
                    instructions: "Could not auto-extract instructions. Please fill manually.",
                    ingredients: [],
                    image_url: ogImage,
                    source_url: url,
                    tags: ['Imported']
                };
            }

            throw new Error("No recipe data found on page.");

        } catch (err) {
            console.error("Import failed:", err);
            throw err;
        }
    };

    const addRecipe = async (recipe) => {
        try {
            if (!user) throw new Error("Not authenticated");

            // 1. Insert Recipe
            const { data: recipeData, error: recipeError } = await supabase
                .from('recipes')
                .insert([{
                    title: recipe.title,
                    instructions: recipe.instructions,
                    tags: recipe.tags,
                    image_url: recipe.image_url,
                    prep_time: recipe.prep_time,
                    cook_time: recipe.cook_time,
                    total_time: recipe.total_time,
                    servings: recipe.servings,
                    source_url: recipe.source_url,
                    user_id: user.id
                }])
                .select()
                .single();

            if (recipeError) throw recipeError;

            // 2. Insert Ingredients
            if (recipe.ingredients && recipe.ingredients.length > 0) {
                const ingredientsToInsert = recipe.ingredients.map(ing => ({
                    recipe_id: recipeData.id,
                    item: ing.item,
                    amount: ing.amount,
                    unit: ing.unit,
                    notes: ing.notes,
                    user_id: user.id
                }));

                const { error: ingError } = await supabase
                    .from('ingredients')
                    .insert(ingredientsToInsert);

                if (ingError) throw ingError;
            }

            // 3. Sync Tags to Master List (Upsert)
            if (recipe.tags && recipe.tags.length > 0) {
                const tagsToSync = recipe.tags.map(tag => ({
                    name: tag,
                    user_id: user.id
                }));

                await supabase
                    .from('recipe_tags')
                    .upsert(tagsToSync, { onConflict: 'name, user_id' });
            }

            // Refresh local state or refetch
            fetchRecipes();
        } catch (err) {
            console.error('Error adding recipe:', err);
            alert('Failed to save recipe: ' + err.message);
        }
    };

    const updateRecipe = async (updatedRecipe) => {
        try {
            if (!user) return;
            // 1. Update Recipe Details
            const { error: recipeError } = await supabase
                .from('recipes')
                .update({
                    title: updatedRecipe.title,
                    instructions: updatedRecipe.instructions,
                    tags: updatedRecipe.tags,
                    image_url: updatedRecipe.image_url,
                    prep_time: updatedRecipe.prep_time,
                    cook_time: updatedRecipe.cook_time,
                    total_time: updatedRecipe.total_time,
                    servings: updatedRecipe.servings,
                    source_url: updatedRecipe.source_url
                })
                .eq('id', updatedRecipe.id)
                .eq('user_id', user.id);

            if (recipeError) throw recipeError;

            // 2. Sync Ingredients (Delete all and re-insert)
            // Note: ingredients doesn't have user_id, it links to recipe_id
            await supabase.from('ingredients').delete().eq('recipe_id', updatedRecipe.id);

            if (updatedRecipe.ingredients && updatedRecipe.ingredients.length > 0) {
                const ingredientsToInsert = updatedRecipe.ingredients.map(ing => ({
                    recipe_id: updatedRecipe.id,
                    item: ing.item,
                    amount: ing.amount,
                    unit: ing.unit,
                    notes: ing.notes,
                    user_id: user.id
                }));

                await supabase.from('ingredients').insert(ingredientsToInsert);
            }

            // 3. Sync Tags to Master List (Upsert)
            if (updatedRecipe.tags && updatedRecipe.tags.length > 0) {
                const tagsToSync = updatedRecipe.tags.map(tag => ({
                    name: tag,
                    user_id: user.id
                }));

                await supabase
                    .from('recipe_tags')
                    .upsert(tagsToSync, { onConflict: 'name, user_id' });
            }

            fetchRecipes();
        } catch (err) {
            console.error('Error updating recipe:', err);
        }
    };

    return {
        recipes,
        loading,
        error,
        mealPlan,
        addRecipe,
        deleteRecipe,
        updateRecipe,
        addToPlan,
        clearDay,
        importRecipe
    };
};

