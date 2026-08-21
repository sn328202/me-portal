/**
 * Server-side recipe extraction.
 *
 * The app already imports recipes in the browser (useRecipes.importRecipe), but
 * it has to hop through public CORS proxies — api.cors.lol, corsproxy.io and
 * friends — which rate-limit, go down, and sometimes return their own landing
 * page instead of the recipe. None of that applies here: a serverless function
 * fetches the page directly.
 *
 * The output shape is deliberately identical to the client importer's, so a
 * recipe that arrives from the phone is indistinguishable from one imported in
 * the Larder.
 *
 * Filename starts with an underscore so Vercel treats it as a helper module
 * rather than publishing it as a route.
 */

import { decode, jsonLdBlocks, metaTag, fetchHtml } from './_html.js';

/** schema.org allows @type to be a string or an array, and nests under @graph. */
const isRecipe = (node) => {
    if (!node || typeof node !== 'object') return false;
    const t = node['@type'];
    return Array.isArray(t) ? t.includes('Recipe') : t === 'Recipe';
};

const findRecipe = (node, depth = 0) => {
    if (depth > 4 || !node || typeof node !== 'object') return null;
    if (isRecipe(node)) return node;
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findRecipe(child, depth + 1);
            if (found) return found;
        }
        return null;
    }
    if (Array.isArray(node['@graph'])) return findRecipe(node['@graph'], depth + 1);
    return null;
};

/** "PT1H30M" -> "1h 30m" */
const parseDuration = (iso) => {
    if (!iso) return '';
    const m = String(iso).match(/PT(\d+H)?(\d+M)?/);
    if (!m) return String(iso);
    return `${m[1] ? m[1].replace('H', 'h ') : ''}${m[2] ? m[2].replace('M', 'm') : ''}`.trim();
};

/** Instructions arrive as a string, a list of steps, or nested HowToSections. */
const flattenInstructions = (raw, depth = 0) => {
    if (!raw || depth > 3) return [];
    if (typeof raw === 'string') return [decode(raw)];
    if (Array.isArray(raw)) return raw.flatMap((s) => flattenInstructions(s, depth + 1));
    if (raw.itemListElement) return flattenInstructions(raw.itemListElement, depth + 1);
    const step = raw.text || raw.name;
    return step ? [decode(step)] : [];
};

const COMMON_UNITS = new Set([
    'cup', 'cups', 'c', 'tsp', 'teaspoon', 'teaspoons', 't',
    'tbsp', 'tablespoon', 'tablespoons', 'oz', 'ounce', 'ounces',
    'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams',
    'kg', 'kilogram', 'kilograms', 'ml', 'milliliter', 'milliliters',
    'l', 'liter', 'liters', 'qt', 'quart', 'quarts', 'pt', 'pint', 'pints',
    'gal', 'gallon', 'gallons', 'pinch', 'pinches', 'dash', 'dashes',
    'sprig', 'sprigs', 'slice', 'slices', 'clove', 'cloves', 'can', 'cans',
    'bottle', 'bottles', 'package', 'packages', 'pkg', 'pkgs',
    'stick', 'sticks', 'piece', 'pieces', 'pcs', 'handful', 'handfuls',
    'head', 'heads', 'bunch', 'bunches', 'drop', 'drops',
]);

/**
 * "1 1/2 cups all-purpose flour, sifted"
 *   -> { amount: "1 1/2", unit: "cups", item: "all-purpose flour", notes: "sifted" }
 *
 * Ported from the client importer so both paths produce the same rows.
 */
export const parseIngredient = (str) => {
    const clean = decode(str);
    // En and em dashes included: recipe writers type "2\u20132.5 cups", and
    // without them the range splits into a bogus amount and a lost unit.
    const numberChar = '[0-9\\u00BC-\\u00BE\\u2150-\\u215E/.\\-\\u2013\\u2014]';
    const amountMatch = clean.match(new RegExp(`^(${numberChar}+(\\s+${numberChar}+)*)`));

    let amount = '1';
    let unit = 'pcs';
    let rest = clean;

    if (amountMatch) {
        amount = amountMatch[0].trim();
        rest = clean.slice(amountMatch[0].length).trim();

        const unitMatch = rest.match(/^([a-zA-Z]+)(\.|s)?(\s+|$)/);
        if (unitMatch) {
            const candidate = unitMatch[1].toLowerCase();
            const base = candidate.endsWith('s') ? candidate.slice(0, -1) : candidate;
            // Whitelisted, so "2 large eggs" keeps "large" in the item rather
            // than mistaking it for a unit.
            if (COMMON_UNITS.has(candidate) || COMMON_UNITS.has(base) || COMMON_UNITS.has(`${candidate}s`)) {
                unit = unitMatch[0].trim();
                rest = rest.slice(unitMatch[0].length).trim();
            }
        }
    }

    let item = rest;
    let notes = '';
    const paren = rest.match(/(.*?)\s*\((.*?)\)/);
    if (paren) {
        item = paren[1];
        notes = paren[2];
    } else if (rest.includes(',')) {
        const [first, ...others] = rest.split(',');
        item = first;
        notes = others.join(',').trim();
    }

    if (!item.trim()) return { amount: '1', unit: 'pcs', item: clean, notes: '' };
    return { amount, unit, item: item.trim(), notes: notes.trim() };
};

/**
 * Fetch a recipe page and extract what the Larder needs.
 * Throws with a message meant to be read aloud on a phone.
 */
export async function extractRecipe(url) {
    const { html, url: finalUrl } = await fetchHtml(url);
    return parseRecipeHtml(html, finalUrl);
}

/**
 * The parsing half, separated from the fetch so it can be exercised against
 * fixtures. Returns the Larder's recipe shape, or throws if the page holds
 * nothing recipe-like at all.
 */
export function parseRecipeHtml(html, sourceUrl) {
    const target = new URL(sourceUrl);
    const recipe = jsonLdBlocks(html).map((b) => findRecipe(b)).find(Boolean);

    if (recipe) {
        const steps = flattenInstructions(recipe.recipeInstructions);
        const image = Array.isArray(recipe.image)
            ? (recipe.image[0]?.url || recipe.image[0])
            : (recipe.image?.url || recipe.image);
        const servings = Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield;
        const rawIngredients = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [];

        return {
            title: decode(recipe.name) || metaTag(html, 'og:title') || target.hostname,
            instructions: steps.join('\n'),
            ingredients: rawIngredients.map(parseIngredient),
            image_url: typeof image === 'string' ? image : null,
            prep_time: parseDuration(recipe.prepTime),
            cook_time: parseDuration(recipe.cookTime),
            total_time: parseDuration(recipe.totalTime),
            servings: servings ? String(servings) : null,
            source_url: target.toString(),
            tags: ['Imported'],
            complete: rawIngredients.length > 0,
        };
    }

    // No structured data. Keep the title and the link rather than losing the
    // thought — a stub she can finish in the Larder beats an error.
    const title = metaTag(html, 'og:title') || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    if (title) {
        return {
            title: decode(title),
            instructions: '',
            ingredients: [],
            image_url: metaTag(html, 'og:image'),
            prep_time: '', cook_time: '', total_time: '',
            servings: null,
            source_url: target.toString(),
            tags: ['Imported'],
            complete: false,
        };
    }

    throw new Error('no recipe was found on that page');
}
