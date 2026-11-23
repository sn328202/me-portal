/**
 * What to buy for a menu.
 *
 * The weekly shopping list works from the meal plan. A dinner party does not
 * live on the meal plan: it is a menu, cooked once, often at a different scale
 * from the recipe as written, often with a substitution or two that only make
 * sense for that one evening, and often bought for alongside another menu (the
 * birthday cake the same weekend). Doing that by hand meant doubling numbers in
 * a spreadsheet, so it lives here instead.
 *
 * A menu remembers how she shops for it in `shop`:
 *
 *   multipliers  { [recipeId]: 2 }            this dish, twice over
 *   swaps        { [key]: { from, to } }      beef stock -> chicken stock, here only
 *   removed      { [key]: label }             not buying this for this menu
 *   extras       [{ id, text }]               4 roasting pans, which no recipe asks for
 *   also         [menuId]                     shop for these menus in the same trip
 *   got          [lineKey]                    ticked off in the shop
 *   pantry       true | false                 count what is already in the cupboard
 *
 * Swaps and removals belong to the menu they were made on. Swapping the stock
 * for Thanksgiving does not swap it in the recipe, or on any other menu shopped
 * for in the same trip.
 *
 * Pure, like shoppingList.js, because the arithmetic is the part that has to be
 * right in the shop.
 */

export const DEFAULT_SHOP = Object.freeze({
    multipliers: {},
    swaps: {},
    removed: {},
    extras: [],
    also: [],
    got: [],
    pantry: true,
});

/** A menu's shopping settings, with every field present whatever was saved. */
export const shopOf = (menu) => {
    const s = (menu && typeof menu.shop === 'object' && menu.shop) || {};
    return {
        multipliers: { ...(s.multipliers || {}) },
        swaps: { ...(s.swaps || {}) },
        removed: { ...(s.removed || {}) },
        extras: Array.isArray(s.extras) ? s.extras : [],
        also: Array.isArray(s.also) ? s.also : [],
        got: Array.isArray(s.got) ? s.got : [],
        pantry: s.pantry !== false,
    };
};

/* ---------- amounts ------------------------------------------------------ */

const VULGAR = {
    '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅕': 0.2, '⅙': 1 / 6,
};

const one = (text) => {
    let s = String(text).trim();
    let total = 0;
    // "2½" and "2 ½" are two and a half.
    for (const [glyph, value] of Object.entries(VULGAR)) {
        if (s.includes(glyph)) {
            total += value;
            s = s.replace(glyph, ' ').trim();
        }
    }
    if (!s) return total || null;
    // "1 1/2"
    const mixed = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) return total + Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) return Number(frac[2]) ? total + Number(frac[1]) / Number(frac[2]) : null;
    const num = s.match(/^\d+(?:\.\d+)?$|^\.\d+$/);
    if (num) return total + Number(s);
    return null;
};

/**
 * A recipe's amount as a number, or null when it is not one ("to taste").
 *
 * A range ("4-6", "4 to 6") is shopped for at its top: running out halfway
 * through a recipe is worse than one spare carrot.
 */
export const parseAmount = (raw) => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const s = String(raw).trim();
    if (!s) return null;
    const range = s.split(/\s*(?:-|–|—|\bto\b)\s*/i).filter(Boolean);
    if (range.length === 2) {
        const hi = one(range[1]);
        if (hi !== null) return hi;
    }
    return one(s);
};

const NICE = [[0, ''], [0.125, '1/8'], [0.25, '1/4'], [1 / 3, '1/3'], [0.5, '1/2'], [2 / 3, '2/3'], [0.75, '3/4'], [1, '']];

/** A number the way it is read in a kitchen: 1 1/2, not 1.5; 0.33 as 1/3. */
export const formatAmount = (n) => {
    if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return '';
    const whole = Math.floor(n + 1e-9);
    const rest = n - whole;
    let best = null;
    for (const [value, label] of NICE) {
        if (Math.abs(rest - value) < 0.03) { best = [value, label]; break; }
    }
    if (best) {
        const w = whole + (best[0] === 1 ? 1 : 0);
        if (!best[1]) return w ? String(w) : String(Math.round(n * 100) / 100);
        return w ? `${w} ${best[1]}` : best[1];
    }
    return String(Math.round(n * 100) / 100);
};

/** "×2", "×1 1/2" — how a scaled dish is labelled. */
export const timesLabel = (m) => `×${formatAmount(m) || '0'}`;

/* ---------- keys --------------------------------------------------------- */

/**
 * What a written ingredient line means, as a key.
 *
 * Keyed the way shoppingList.js keys things, by the pantry match when there is
 * one, so a swap made against "low-sodium beef stock" also catches "beef stock"
 * in the next recipe when both resolve to the same pantry row.
 */
export const keyFor = (text, matcher) => {
    const raw = String(text || '').trim();
    const r = matcher?.matchOne?.(raw) || {};
    if (r.item) return { key: `ing-${r.item.id}`, item: r.item };
    const n = (r.normalised || raw).toLowerCase().trim();
    return { key: `raw-${n}`, item: null };
};

/* ---------- the list ----------------------------------------------------- */

/**
 * Every line to buy across one or more menus.
 *
 * `menus[0]` is the menu being shopped from; the others are the ones it has
 * been told to shop alongside. Each menu's own dish multipliers, swaps and
 * removals apply to its own dishes only. Ticks, extras and the pantry setting
 * come from the first menu, since that is the list she is holding.
 *
 * Returns the lines (shaped for `byAisle` in shoppingList.js) and the changes
 * that were applied, so the page can show them and undo them.
 */
export const menuShopping = ({ menus = [], recipes = [], matcher, pantryStock = {} } = {}) => {
    const primary = shopOf(menus[0]);
    const usePantry = primary.pantry;
    const got = new Set(primary.got);

    const rows = new Map();
    const changes = [];
    const seenChange = new Set();

    const add = (rowKey, make, mutate) => {
        let row = rows.get(rowKey);
        if (!row) {
            row = make();
            rows.set(rowKey, row);
        }
        mutate(row);
    };

    menus.forEach((menu, menuIndex) => {
        if (!menu) return;
        const cfg = shopOf(menu);
        const menuTitle = menu.title || 'Menu';

        // Changes are listed once per menu, even when two dishes hit them.
        Object.entries(cfg.swaps).forEach(([key, s]) => {
            const id = `${menu.id}:${key}`;
            if (seenChange.has(id)) return;
            seenChange.add(id);
            changes.push({ menuId: menu.id, menuTitle, key, kind: 'swap', from: s?.from || key, to: s?.to || '' });
        });
        Object.entries(cfg.removed).forEach(([key, label]) => {
            const id = `${menu.id}:${key}`;
            if (seenChange.has(id)) return;
            seenChange.add(id);
            changes.push({ menuId: menu.id, menuTitle, key, kind: 'removed', from: label || key });
        });

        (menu.user_larder_menu_recipes || []).forEach((entry) => {
            if (!entry) return;

            // Something bought rather than cooked: the wine, the cookies.
            if (!entry.recipe_id) {
                const name = String(entry.item_name || '').trim();
                if (!name) return;
                const { key, item } = keyFor(name, matcher);
                if (cfg.removed[key]) return;
                const rowKey = `${key}@item`;
                add(rowKey, () => ({
                    key: rowKey,
                    label: name,
                    amount: 0,
                    unit: '',
                    loose: [],
                    Icon: item?.icon || null,
                    category: item?.category || 'Drinks',
                    ingredientId: item?.id || null,
                    notes: [],
                    origins: [],
                }), (row) => {
                    if (entry.item_note && !row.loose.includes(entry.item_note)) row.loose.push(entry.item_note);
                    const note = menuIndex ? menuTitle : (entry.course_name || 'menu');
                    if (!row.notes.includes(note)) row.notes.push(note);
                    if (!row.origins.some((o) => o.menuId === menu.id && o.key === key)) {
                        row.origins.push({ menuId: menu.id, key, label: name });
                    }
                });
                return;
            }

            const recipe = recipes.find((r) => r.id === entry.recipe_id);
            if (!recipe) return;
            const mult = Number(cfg.multipliers[recipe.id] ?? 1);
            if (!(mult > 0)) return;
            const dish = `${recipe.title || 'Untitled'}${mult !== 1 ? ` ${timesLabel(mult)}` : ''}`;

            (recipe.ingredients || []).forEach((ing) => {
                const written = String(ing?.item || '').trim();
                if (!written) return;
                const original = keyFor(written, matcher);
                if (cfg.removed[original.key]) return;

                const swap = cfg.swaps[original.key];
                const text = swap?.to ? swap.to : written;
                const resolved = swap?.to ? keyFor(text, matcher) : original;
                const unit = String(ing.unit || '').trim();
                const rowKey = `${resolved.key}@${unit}`;
                const amount = parseAmount(ing.amount);

                add(rowKey, () => ({
                    key: rowKey,
                    // Her words win: a swap reads back as she typed it, a match as the pantry names it.
                    label: swap?.to ? text : (resolved.item ? resolved.item.label : written),
                    amount: 0,
                    unit,
                    loose: [],
                    Icon: resolved.item?.icon || null,
                    category: resolved.item?.category || '',
                    ingredientId: resolved.item?.id || null,
                    swappedFrom: swap?.to ? (swap.from || written) : null,
                    notes: [],
                    origins: [],
                }), (row) => {
                    if (amount !== null) row.amount += amount * mult;
                    else if (String(ing.amount || '').trim()) {
                        const loose = String(ing.amount).trim();
                        if (!row.loose.includes(loose)) row.loose.push(loose);
                    }
                    if (!row.notes.includes(dish)) row.notes.push(dish);
                    if (!row.origins.some((o) => o.menuId === menu.id && o.key === original.key)) {
                        row.origins.push({ menuId: menu.id, key: original.key, label: written });
                    }
                });
            });
        });
    });

    // Things no recipe asks for: roasting pans, ice, a lemon for the table.
    primary.extras.forEach((extra) => {
        const text = String(extra?.text || '').trim();
        if (!text) return;
        const { item } = keyFor(text, matcher);
        const rowKey = `extra-${extra.id}`;
        rows.set(rowKey, {
            key: rowKey,
            label: text,
            amount: 0,
            unit: '',
            loose: [],
            Icon: item?.icon || null,
            category: item?.category || '',
            ingredientId: item?.id || null,
            notes: [],
            origins: [],
            extraId: extra.id,
        });
    });

    const lines = [...rows.values()].map((row) => ({
        ...row,
        inStock: usePantry && !!row.ingredientId && !!pantryStock[row.ingredientId],
        checked: got.has(row.key),
    }));

    return { lines, changes };
};

/** "2 1/2 cups", "1 bottle + a splash", or "" — the amount column of a line. */
export const amountText = (line) => {
    const parts = [];
    const n = formatAmount(line?.amount);
    if (n) parts.push(`${n}${line.unit ? ` ${line.unit}` : ''}`);
    (line?.loose || []).forEach((l) => parts.push(l));
    return parts.join(' + ');
};

/* ---------- changing the settings ---------------------------------------- */

/* Every edit returns a new settings object, so the page can save it whole. */

export const setMultiplier = (shop, recipeId, m) => {
    const next = shopOf({ shop });
    if (m === 1) delete next.multipliers[recipeId];
    else next.multipliers[recipeId] = m;
    return next;
};

/**
 * Swap an ingredient for this menu only.
 *
 * A line can be the merge of several written lines (two recipes' garlic), so a
 * swap is made against every original key behind it that belongs to this menu.
 */
export const swapLine = (shop, menuId, line, to) => {
    const next = shopOf({ shop });
    const target = String(to || '').trim();
    if (!target) return next;
    (line?.origins || []).filter((o) => o.menuId === menuId).forEach((o) => {
        next.swaps[o.key] = { from: next.swaps[o.key]?.from || o.label, to: target };
    });
    return next;
};

export const removeLine = (shop, menuId, line) => {
    const next = shopOf({ shop });
    if (line?.extraId) {
        next.extras = next.extras.filter((e) => e.id !== line.extraId);
        return next;
    }
    (line?.origins || []).filter((o) => o.menuId === menuId).forEach((o) => {
        next.removed[o.key] = next.swaps[o.key]?.from || o.label;
        delete next.swaps[o.key];
    });
    next.got = next.got.filter((k) => k !== line?.key);
    return next;
};

export const undoChange = (shop, key) => {
    const next = shopOf({ shop });
    delete next.swaps[key];
    delete next.removed[key];
    return next;
};

export const addExtra = (shop, text, id = `x${Date.now().toString(36)}`) => {
    const next = shopOf({ shop });
    const t = String(text || '').trim();
    if (t) next.extras = [...next.extras, { id, text: t }];
    return next;
};

export const toggleGot = (shop, lineKey) => {
    const next = shopOf({ shop });
    next.got = next.got.includes(lineKey) ? next.got.filter((k) => k !== lineKey) : [...next.got, lineKey];
    return next;
};

export const toggleAlso = (shop, menuId) => {
    const next = shopOf({ shop });
    next.also = next.also.includes(menuId) ? next.also.filter((id) => id !== menuId) : [...next.also, menuId];
    return next;
};

/** The list as text for a message: what is left to buy, by aisle. */
export const menuListAsText = ({ title = 'Shopping list', aisles = [] } = {}) => {
    if (!aisles.length) return `${title}\n\nNothing to buy.\n`;
    const sections = aisles.map(({ name, lines }) => [
        name.toUpperCase(),
        ...lines.map((l) => {
            const amt = amountText(l);
            return `- [ ] ${amt ? `${amt} ` : ''}${l.label}${l.notes.length ? ` (${l.notes.join(', ')})` : ''}`;
        }),
    ].join('\n'));
    return `${title}\n\n${sections.join('\n\n')}\n`;
};
