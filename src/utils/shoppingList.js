/**
 * One shopping list out of two sources.
 *
 * Half of what she needs to buy she typed; the other half is implied by the
 * meal plan — every ingredient of every recipe on it, minus whatever is
 * already in the cupboard. Keeping those in two places is how you buy basil
 * twice, so they are one list with a rule about ordering: what is still needed
 * first, what is already in the pantry last.
 *
 * Pure, because the interesting part is the aggregation — the same ingredient
 * arriving from three recipes in three spellings has to land on one line, and
 * getting that subtly wrong is invisible until you are standing in a shop.
 */

/**
 * Everything the meal plan implies, aggregated.
 *
 * `matcher.matchOne` resolves a written line ("2 cloves garlic") to a known
 * ingredient; the shopping list is the place a bad match hurts most, because
 * an unmatched line becomes a second entry for something already in the
 * cupboard.
 */
export const plannedFrom = ({ plan, recipes, matcher, pantryStock = {} } = {}) => {
    const out = {};
    if (!plan || !recipes) return [];

    Object.values(plan).flat().forEach((recipeId) => {
        const recipe = recipes.find((r) => r.id === recipeId);
        if (!recipe) return;

        (recipe.ingredients || []).forEach((ing) => {
            const resolved = matcher?.matchOne?.(ing.item || '') || {};
            const match = resolved.item;
            const lowerName = resolved.normalised || String(ing.item || '').toLowerCase().trim();
            if (!match && !lowerName) return;

            const key = match ? match.id : lowerName;
            const unit = ing.unit || '';
            // Grouped by ingredient *and* unit: 200g of butter and 2 tbsp of
            // butter are the same shop but not the same number.
            const uniqueKey = `${key}-${unit}`;

            if (!out[uniqueKey]) {
                out[uniqueKey] = {
                    key: uniqueKey,
                    label: match ? match.label : ing.item,
                    amount: 0,
                    unit,
                    Icon: match ? match.icon : null,
                    inStock: match ? !!pantryStock[match.id] : false,
                };
            }
            const val = parseFloat(ing.amount);
            if (!Number.isNaN(val)) out[uniqueKey].amount += val;
        });
    });

    // Still needed first; what is already in the cupboard falls to the bottom,
    // where it reads as reassurance rather than as a line to shop for.
    return Object.values(out).sort((a, b) => Number(a.inStock) - Number(b.inStock));
};

/**
 * The list as something you can paste into a message or read in a shop.
 *
 * What is ticked and what is already in the pantry are both left out: this is
 * the list of things to put in the basket, and a line you do not need is a
 * line you have to read past while holding a basket.
 */
export const listAsText = ({ items = [], planned = [], title = 'SHOPPING', hearth = 'FROM THE HEARTH' } = {}) => {
    let text = `${title} LIST\n\n`;

    const needed = items.filter((i) => !i.checked);
    if (needed.length) {
        text += `${title}:\n`;
        needed.forEach((i) => { text += `- [ ] ${i.text}\n`; });
        text += '\n';
    }

    const toBuy = planned.filter((i) => !i.inStock);
    if (toBuy.length) {
        text += `${hearth}:\n`;
        toBuy.forEach((ing) => {
            const amount = ing.amount > 0 ? `${ing.amount} ${ing.unit} `.replace(/\s+/g, ' ') : '';
            text += `- [ ] ${amount}${ing.label}\n`;
        });
    }

    return text;
};

/** How many lines are actually still to buy, for a count on a heading. */
export const stillToBuy = (items = [], planned = []) => items.filter((i) => !i.checked).length
    + planned.filter((p) => !p.inStock).length;
