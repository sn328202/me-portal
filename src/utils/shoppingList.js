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
                    category: match?.category || '',
                    inStock: match ? !!pantryStock[match.id] : false,
                    ingredientId: match ? match.id : null,
                    notes: [],
                };
            }
            const val = parseFloat(ing.amount);
            if (!Number.isNaN(val)) out[uniqueKey].amount += val;
            if (recipe.title && !out[uniqueKey].notes.includes(recipe.title)) {
                out[uniqueKey].notes.push(recipe.title);
            }
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


/* ---------- one list, not two ------------------------------------------ */

/**
 * Everything to buy, merged.
 *
 * The Larder's list kept the two halves apart and never compared them, so
 * "garlic" typed by hand and "4 cloves garlic" from a recipe were two lines in
 * two different places on the page — and buying twice is exactly what a
 * shopping list exists to prevent. They are one line here, keyed the same way
 * the pantry matcher keys everything else, so they merge on meaning rather
 * than on spelling.
 *
 * Her words win the label. A thing she wrote down herself should read back as
 * she wrote it, not as the pantry's tidy name for it.
 */
export const mergeList = ({ items = [], planned = [], matcher, pantryStock = {} } = {}) => {
    const out = new Map();

    for (const item of items) {
        const text = String(item?.text || '').trim();
        if (!text) continue;
        const resolved = matcher?.matchOne?.(text) || {};
        const match = resolved.item;
        const key = match ? `ing-${match.id}` : `raw-${resolved.normalised || text.toLowerCase()}`;

        out.set(key, {
            key,
            label: text,
            amount: 0,
            unit: '',
            Icon: match ? match.icon : null,
            category: match?.category || '',
            ingredientId: match ? match.id : null,
            inStock: match ? !!pantryStock[match.id] : false,
            notes: [],
            itemId: item.id,
            checked: !!item.checked,
        });
    }

    for (const ing of planned) {
        const key = ing.ingredientId ? `ing-${ing.ingredientId}` : `raw-${String(ing.label || '').toLowerCase()}`;
        const had = out.get(key);
        if (had) {
            // Same thing, said twice. Keep her label, take the recipe's amount
            // and the reason it is needed.
            had.amount += ing.amount || 0;
            had.unit = had.unit || ing.unit;
            had.notes = [...new Set([...had.notes, ...(ing.notes || [])])];
            had.Icon = had.Icon || ing.Icon;
            had.category = had.category || ing.category;
            continue;
        }
        out.set(key, { ...ing, key, itemId: null, checked: false, notes: ing.notes || [] });
    }

    return [...out.values()];
};

/** Where in a shop it lives. Unmatched things go to the end, not into Produce. */
const AISLES = ['Produce', 'Dairy', 'Protein', 'Bakery', 'Frozen', 'Pantry', 'Spices', 'Drinks'];
const MISC = 'Anything else';

/* A face for each aisle. Not decoration: the list is read at arm's length in
   a shop, and a shape catches the eye a whole word before the word does. */
const FACES = {
    Produce: '\u{1F96C}',
    Dairy: '\u{1F9C0}',
    Protein: '\u{1F357}',
    Bakery: '\u{1F35E}',
    Frozen: '\u{1F9CA}',
    Pantry: '\u{1F96B}',
    Spices: '\u{1F9C2}',
    Drinks: '\u{1F375}',
    [MISC]: '\u{1F9FA}',
};

export const faceOf = (aisle) => FACES[aisle] || '\u{1F4CE}';

export const aisleOf = (line) => {
    const want = String(line?.category || '').trim();
    if (!want) return MISC;
    const hit = AISLES.find((a) => a.toLowerCase() === want.toLowerCase());
    return hit || want;
};

/**
 * The list as a shop is laid out, with what you already have at the end.
 *
 * Aisles in the order you walk them rather than alphabetically: a list sorted
 * A–Z sends you back across the shop for the yoghurt. Anything already in the
 * pantry drops out of its aisle and into its own group at the bottom, because
 * it is worth seeing once and is not worth walking for.
 */
export const byAisle = (lines = []) => {
    const needed = lines.filter((l) => !l.inStock && !l.checked);
    const have = lines.filter((l) => l.inStock || l.checked);

    const groups = new Map();
    for (const line of needed) {
        const aisle = aisleOf(line);
        if (!groups.has(aisle)) groups.set(aisle, []);
        groups.get(aisle).push(line);
    }

    const rank = (name) => {
        const i = AISLES.indexOf(name);
        if (i !== -1) return i;
        return name === MISC ? AISLES.length + 1 : AISLES.length;
    };

    const aisles = [...groups.entries()]
        .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
        .map(([name, of]) => ({
            name,
            face: faceOf(name),
            lines: of.sort((x, y) => x.label.localeCompare(y.label)),
        }));

    return { aisles, have, needed: needed.length };
};
