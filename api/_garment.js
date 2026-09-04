/**
 * Turning "a black wool blazer" into a row in her closet.
 *
 * The Wardrobe is not a Postgres table. It is the outfit planner's own
 * localStorage, mirrored into `wardrobe_state` as one JSON blob per key — so
 * adding a garment from a dictation means reading that blob, putting something
 * in it, and writing it back. All of the shaping is here so it can be tested
 * without a database, because the failure that matters is silent: a garment
 * written with a category the planner does not know is a garment that never
 * appears on any screen.
 */

/* The planner's own vocabulary. If these drift, garments land in a section
   that does not exist and simply vanish, so they are copied deliberately
   rather than imported — `outfit-planner.html` is a standalone file with no
   module system to import from. */
export const CATS = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Swimwear'];
export const DRESS = ['Casual', 'Smart casual', 'Business casual', 'Cocktail / dressy', 'Formal'];
export const WARMTH = ['Very light', 'Light', 'Medium', 'Warm', 'Very warm'];
export const STYLES = ['Everyday', 'Athleisure', 'Travel'];
const AGNOSTIC = 'Accessories';

/* A last resort, not the main road: the model is asked for a category and the
   schema constrains it to the list. This is for when it answers with a word
   that is nearly right — "shirt" rather than "Tops". */
const HINTS = [
    [/\b(t-?shirt|shirt|top|blouse|sweater|jumper|cardigan|knit|tank|camisole|hoodie|sweatshirt|turtleneck|tee)\b/i, 'Tops'],
    [/\b(jeans|trousers|pants|skirt|shorts|leggings|chinos|joggers|culottes|slacks)\b/i, 'Bottoms'],
    [/\b(dress|gown|jumpsuit|romper|frock|saree|sari|lehenga|kurta)\b/i, 'Dresses'],
    [/\b(jacket|coat|blazer|parka|anorak|windbreaker|overcoat|puffer|trench|shawl)\b/i, 'Outerwear'],
    [/\b(shoes?|boots?|sneakers?|trainers?|heels?|sandals?|loafers?|flats?|slippers?|pumps?)\b/i, 'Shoes'],
    [/\b(bag|purse|belt|scarf|hat|cap|gloves|sunglasses|jewell?ery|necklace|earrings|watch|tie)\b/i, 'Accessories'],
    [/\b(swimsuit|swimming costume|bikini|trunks|swim shorts|rash guard)\b/i, 'Swimwear'],
];

export const categoryOf = (given, name = '') => {
    const exact = CATS.find((c) => c.toLowerCase() === String(given || '').trim().toLowerCase());
    if (exact) return exact;
    for (const [re, cat] of [...HINTS]) {
        if (re.test(String(given || '')) || re.test(String(name || ''))) return cat;
    }
    // Nothing matched. Tops is the biggest drawer and a garment in the wrong
    // drawer can be moved; a garment in no drawer cannot be found.
    return 'Tops';
};

/** A word or a number, in; 1–5, out. */
const level = (given, list, fallback) => {
    const n = Number(given);
    if (Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
    const i = list.findIndex((label) => label.toLowerCase() === String(given || '').trim().toLowerCase());
    return i === -1 ? fallback : i + 1;
};

/** Two ways of writing the same garment are the same garment. */
export const nameKey = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

let counter = 0;
const newId = () => `cap${Date.now().toString(36)}${(counter += 1).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** One dictated garment, in the shape the planner stores. */
export const shapeGarment = (raw = {}) => {
    const name = String(raw.name || '').trim();
    if (!name) return null;
    const cat = categoryOf(raw.cat ?? raw.category, name);
    return {
        id: newId(),
        cat,
        name,
        color: String(raw.color || '').trim(),
        // Accessories go with everything, so the planner ignores their
        // dressiness — it is stored as 1 rather than left to mean something.
        dress: cat === AGNOSTIC ? 1 : level(raw.dress, DRESS, 1),
        warmth: cat === AGNOSTIC ? 3 : level(raw.warmth, WARMTH, 3),
        rain: Boolean(raw.rain),
        style: STYLES.includes(raw.style) ? raw.style : 'Everyday',
        notes: String(raw.notes || '').trim(),
        img: '',
    };
};

/**
 * Put garments into a profile's closet, skipping ones already there.
 *
 * Dictating a wardrobe is not a single sitting — she will do a drawer, stop,
 * and come back. Saying "black jeans" twice should leave one pair of black
 * jeans, so a name already in the closet is counted as a duplicate and
 * reported rather than added.
 *
 * Returns the whole `closets` object, a new one, plus what happened — the
 * caller has to write the blob back and wants to say what it did.
 */
export const addGarments = (closets, profileId, garments = []) => {
    const all = { ...(closets && typeof closets === 'object' ? closets : {}) };
    const existing = Array.isArray(all[profileId]) ? all[profileId] : [];
    const seen = new Set(existing.map((g) => nameKey(g?.name)));

    const added = [];
    const duplicates = [];
    const rejected = [];

    for (const raw of garments) {
        const shaped = shapeGarment(raw);
        if (!shaped) { rejected.push(raw); continue; }
        const key = nameKey(shaped.name);
        // Also against this batch: "two white shirts" dictated as two lines is
        // still one white shirt as far as a name can tell.
        if (seen.has(key)) { duplicates.push(shaped.name); continue; }
        seen.add(key);
        added.push(shaped);
    }

    all[profileId] = [...existing, ...added];
    return { closets: all, added, duplicates, rejected };
};

/** "3 to Tops, 1 to Shoes" — what to tell her it did. */
export const describeAdded = (added = []) => {
    const byCat = {};
    added.forEach((g) => { byCat[g.cat] = (byCat[g.cat] || 0) + 1; });
    return CATS.filter((c) => byCat[c]).map((c) => `${byCat[c]} to ${c}`).join(', ');
};


/* ---------- outfits ---------------------------------------------------- */

/**
 * Find a garment she has just named.
 *
 * Dictation is not a picker. "the black jeans" has to reach a garment stored
 * as "high waisted black jeans", so an exact name is tried first and then a
 * containment either way — but only when exactly one garment matches. Two
 * candidates is not a near miss, it is a question, and guessing between them
 * puts the wrong trousers in her outfit and says nothing.
 */
export const matchGarment = (items = [], spoken) => {
    const want = nameKey(spoken);
    if (!want) return null;

    const exact = items.filter((g) => nameKey(g?.name) === want);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return exact[0]; // identical names: either will do

    const loose = items.filter((g) => {
        const have = nameKey(g?.name);
        return have.includes(want) || want.includes(have);
    });
    return loose.length === 1 ? loose[0] : null;
};

/**
 * An outfit, from the names she said.
 *
 * A look holds one garment per category — that is the planner's shape, not a
 * simplification — so naming two tops for one outfit cannot be stored. It is
 * reported rather than silently dropped, because a look that quietly lost half
 * of what she said is worse than one she is told to fix.
 */
export const buildLook = (items = [], { name, pieces = [] } = {}) => {
    const chosen = {};
    const used = [];
    const missing = [];
    const clashes = [];

    for (const spoken of pieces) {
        const hit = matchGarment(items, spoken);
        if (!hit) { missing.push(String(spoken || '').trim()); continue; }
        if (chosen[hit.cat]) { clashes.push(hit.name); continue; }
        chosen[hit.cat] = hit.id;
        used.push(hit);
    }

    if (!used.length) return { look: null, used, missing, clashes };

    return {
        look: {
            id: `cap${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
            name: String(name || '').trim() || 'Untitled look',
            items: chosen,
            created: Date.now(),
        },
        used,
        missing,
        clashes,
    };
};

/** Put a look in a profile's shelf, refusing one she already has by name. */
export const addLook = (looksAll, profileId, look) => {
    const all = { ...(looksAll && typeof looksAll === 'object' ? looksAll : {}) };
    const existing = Array.isArray(all[profileId]) ? all[profileId] : [];
    if (existing.some((l) => nameKey(l?.name) === nameKey(look?.name))) {
        return { looks: all, added: false };
    }
    all[profileId] = [...existing, look];
    return { looks: all, added: true };
};
