/**
 * Matching a recipe's ingredient line to something in the pantry.
 *
 * Four places in the app used to do this, and all four did the same thing:
 *
 *     ingredientsByName[(ing.item || '').toLowerCase().trim()]
 *
 * An exact string lookup. So a pantry row called `bay leaf` was found by
 * "bay leaf" and by nothing else — not "1 bay leaf", not "include a bay leaf",
 * not "2 dried bay leaves". And "deggi mirch indian chilli powder" could never
 * find `red chilli powder`, because no amount of exact matching gets you from
 * one string to the other.
 *
 * This module replaces all four with one matcher, in two halves:
 *
 *   normalise()  strips a line down to the ingredient it is actually naming
 *   matchOne()   finds the closest pantry row, and says how sure it is
 *
 * The important property of normalisation here is **consistency, not
 * linguistic correctness**. Both sides of every comparison go through the same
 * pipeline, so "molasses" reducing to a non-word is harmless as long as the
 * pantry's copy reduces to the same non-word. That is why the singulariser is
 * a handful of blunt rules rather than a real stemmer.
 */

/* ---------- vocabulary --------------------------------------------------- */

/**
 * Words a recipe puts in front of the thing it means. Stripped only from the
 * *start* of a line, so "add" cannot eat the word inside "added sugar".
 */
const LEADING_FILLER = new Set([
    'get', 'buy', 'grab', 'pick', 'up', 'include', 'add', 'adding', 'use', 'using',
    'take', 'need', 'want', 'some', 'a', 'an', 'the', 'of', 'about', 'around',
    'approximately', 'roughly', 'maybe', 'perhaps', 'plus', 'also', 'and',
    'optional', 'optionally', 'your', 'my', 'favourite', 'favorite',
]);

/**
 * Preparation and quality words. These describe what you *do* to an ingredient
 * or how nice it is, never which ingredient it is.
 *
 * Deliberately absent: fresh, dried, ground, whole, and every colour. Those
 * look like noise and are not — this pantry distinguishes `dried red chillies`
 * from `green chilli`, `red chilli powder` from `white pepper powder`, and
 * `ground pork` from pork. Stripping them would collapse real distinctions.
 */
const PREP_WORDS = new Set([
    'chopped', 'finely', 'coarsely', 'diced', 'minced', 'sliced', 'thinly',
    'thickly', 'grated', 'shredded', 'crushed', 'smashed', 'torn', 'cubed',
    'julienned', 'trimmed', 'halved', 'quartered', 'peeled', 'seeded',
    'deseeded', 'destemmed', 'stemmed', 'pitted', 'zested', 'juiced', 'beaten',
    'whisked', 'sifted', 'softened', 'melted', 'toasted', 'roasted', 'cooked',
    'uncooked', 'boiled', 'blanched', 'drained', 'rinsed', 'washed', 'cleaned',
    'divided', 'packed', 'heaped', 'heaping', 'level', 'generous', 'scant',
    'lightly', 'well', 'very', 'good', 'quality', 'best', 'nice', 'ripe',
    'freshly', 'newly', 'just', 'preferably', 'ideally',
    'large', 'small', 'medium', 'big', 'tiny', 'extra', 'more', 'plenty',
    'room', 'temperature', 'cold', 'warm', 'hot', 'chilled', 'frozen',
    'organic', 'free', 'range', 'boneless', 'skinless', 'thin', 'thick',
    'serving', 'garnish', 'taste', 'needed', 'required', 'to', 'for',
]);

/**
 * Heads that name a *form* rather than an ingredient. A shared "powder" is not
 * evidence that cumin powder is chilli powder, so a match resting only on
 * these is thrown away.
 */
const GENERIC_HEADS = new Set([
    'powder', 'powdered', 'seeds', 'seed', 'sauce', 'paste', 'flakes', 'flake',
    'extract', 'leaves', 'leaf', 'pieces', 'piece', 'stock', 'broth', 'mix',
    'blend', 'ground', 'whole', 'fresh', 'dried', 'chopped', 'wine',
]);

/** Units, so a stray "cup" in the middle of a line does not become the noun. */
const UNITS = new Set([
    'cup', 'cups', 'c', 'tsp', 'teaspoon', 'teaspoons', 't', 'tbsp', 'tbs',
    'tablespoon', 'tablespoons', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound',
    'pounds', 'g', 'gr', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'ml',
    'milliliter', 'milliliters', 'millilitre', 'millilitres', 'l', 'liter',
    'liters', 'litre', 'litres', 'qt', 'quart', 'quarts', 'pt', 'pint',
    'pints', 'gal', 'gallon', 'gallons', 'pinch', 'pinches', 'dash', 'dashes',
    'sprig', 'sprigs', 'slice', 'slices', 'clove', 'cloves', 'can', 'cans',
    'bottle', 'bottles', 'package', 'packages', 'pkg', 'pkgs', 'stick',
    'sticks', 'piece', 'pieces', 'pcs', 'pc', 'handful', 'handfuls', 'head',
    'heads', 'bunch', 'bunches', 'drop', 'drops', 'jar', 'jars', 'tin', 'tins',
    'box', 'boxes', 'bag', 'bags', 'knob', 'knobs', 'stalk', 'stalks',
]);

/**
 * Spelling variants collapsed before anything else looks at the words. These
 * are not synonyms — they are the same word spelled differently, and treating
 * them separately makes every later rule twice as hard.
 */
const SPELLINGS = {
    chile: 'chilli', chili: 'chilli', chilies: 'chilli', chiles: 'chilli',
    chillies: 'chilli', chillis: 'chilli', chilis: 'chilli',
    yoghurt: 'yogurt', curd: 'yogurt',
    cornflour: 'cornstarch',
    scallion: 'spring onion', scallions: 'spring onion',
    aubergine: 'eggplant', courgette: 'zucchini', rocket: 'arugula',
    prawns: 'shrimp', prawn: 'shrimp',
    beetroot: 'beet', sultanas: 'golden raisins',
    capsicum: 'red pepper',
};

/**
 * Real synonyms: different names for the same thing. Written left-to-right —
 * the key is what a recipe might say, the value is what this pantry calls it.
 *
 * Weighted heavily towards Indian and East Asian cooking, because that is what
 * this pantry is: it holds amchur, hing, kasuri methi, garam masala, shaoxing
 * wine and lao gan ma, and a recipe written in Hindi transliteration would
 * otherwise miss every one of them.
 */
const SYNONYMS = {
    // Indian names for what the pantry already holds
    'deggi mirch': 'red chilli powder',
    'lal mirch': 'red chilli powder',
    'kashmiri mirch': 'kashmiri red chilli powder',
    'kashmiri chilli': 'kashmiri red chilli powder',
    'haldi': 'turmeric',
    'turmeric powder': 'turmeric',
    'jeera': 'cumin seeds',
    'jeera powder': 'cumin powder',
    'ground cumin': 'cumin powder',
    'dhania powder': 'coriander powder',
    'ground coriander': 'coriander powder',
    'dhania': 'cilantro',
    'kali mirch': 'black pepper',
    'tej patta': 'bay leaf',
    'elaichi': 'green cardamom',
    'dalchini': 'cinnamon',
    'laung': 'cloves',
    'hari mirch': 'green chilli',
    'adrak': 'ginger',
    'lehsun': 'garlic',
    'pyaz': 'onion',
    'tamatar': 'tomato',
    'namak': 'salt',
    'asafoetida': 'hing',
    'asafetida': 'hing',
    'dried fenugreek leaves': 'kasuri methi',
    'fenugreek leaves': 'kasuri methi',
    'methi leaves': 'kasuri methi',
    'dry mango powder': 'amchur',
    'mango powder': 'amchur',
    'masoor dal': 'orange masoor dal',
    'red lentils': 'orange masoor dal',

    // East Asian
    'chinese cooking wine': 'shaoxing wine',
    'rice wine': 'shaoxing wine',
    'soya sauce': 'soy sauce',
    'light soy sauce': 'soy sauce',
    'toasted sesame oil': 'sesame oil',
    'chilli crisp': 'lao gan ma',
    'chilli oil crisp': 'lao gan ma',
    'doubanjiang': 'spicy bean sauce',
    'birds eye chilli': "bird's eye chilli",
    'thai chilli': "bird's eye chilli",
    'makrut lime leaves': 'kaffir lime leaves',

    // Same thing, two names
    'corn starch': 'cornstarch',
    'coriander leaves': 'cilantro',
    'fresh coriander': 'cilantro',
    'green onion': 'spring onion',
    'green onions': 'spring onion',
    'salad onion': 'spring onion',
    'spring onion greens': 'spring onion',

    // Western
    'all purpose flour': 'flour',
    'plain flour': 'flour',
    'maida': 'flour',
    'caster sugar': 'sugar',
    'granulated sugar': 'sugar',
    'icing sugar': "confectioner's sugar",
    'powdered sugar': "confectioner's sugar",
    'confectioners sugar': "confectioner's sugar",
    'double cream': 'heavy cream',
    'heavy whipping cream': 'heavy cream',
    'whipping cream': 'heavy cream',
    'half and half': 'half-and-half',
    'garbanzo beans': 'chickpeas',
    'coriander seed': 'coriander seeds',
    'peppercorns': 'black peppercorns',
    'sea salt': 'flaky sea salt',
    'kosher salt': 'salt',
    'table salt': 'salt',
};

/* ---------- normalisation ------------------------------------------------ */

/** Plurals, blunt but consistent. Both sides run through it, so it agrees with itself. */
const IRREGULAR = {
    leaves: 'leaf', knives: 'knife', loaves: 'loaf', halves: 'half',
    tomatoes: 'tomato', potatoes: 'potato', mangoes: 'mango', chillies: 'chilli',
    children: 'child', teeth: 'tooth', feet: 'foot', geese: 'goose',
    // Ends in -ses and is not a plural. `glasses -> glass` is right, so the
    // rule stays; this is the exception that has to be named.
    molasses: 'molasses',
};

export const singular = (word) => {
    if (IRREGULAR[word]) return IRREGULAR[word];
    if (word.length <= 3) return word;
    // Mass nouns and Latin endings that only look plural.
    if (/(ss|us|is|ics)$/.test(word)) return word;
    if (/ies$/.test(word)) return `${word.slice(0, -3)}y`;
    if (/(ches|shes|xes|zes|ses)$/.test(word)) return word.slice(0, -2);
    if (/oes$/.test(word)) return word.slice(0, -2);
    if (/s$/.test(word)) return word.slice(0, -1);
    return word;
};

/** Everything that is not a letter, a digit or a space stops being interesting. */
const flatten = (text) => String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')      // strip accents
    .replace(/['’`]/g, '')                 // confectioner's -> confectioners
    .replace(/[^a-z0-9\s./-]/g, ' ')
    .replace(/[-/.]/g, ' ')                // half-and-half -> half and half
    .replace(/\s+/g, ' ')
    .trim();

/** Fractions, ranges and bare numbers carry no identity. */
const isQuantity = (word) => /^[0-9¼-¾⅐-⅞]+$/.test(word)
    || /^[0-9]+([./][0-9]+)?$/.test(word);

/**
 * "200g", "2tbsp", "1kg" - a number welded to its unit. Neither half survives
 * isQuantity() or UNITS on its own, so the whole token has to be recognised
 * before it ends up being treated as the name of the ingredient.
 */
const isQuantityWithUnit = (word) => {
    const m = word.match(/^([0-9]+(?:[./][0-9]+)?)([a-z]+)$/);
    return Boolean(m) && UNITS.has(m[2]);
};

const isMeasure = (word) => isQuantity(word) || isQuantityWithUnit(word) || UNITS.has(word);

/**
 * Reduce a raw ingredient line to the ingredient it names.
 *
 *   "1 bay leaf"                        -> "bay leaf"
 *   "include a bay leaf"                -> "bay leaf"
 *   "2 tbsp freshly ground black pepper"-> "ground black pepper"
 *   "get deggi mirch indian chilli powder" -> "red chilli powder"
 *
 * Returns the normalised string and its tokens, so callers do not re-split.
 */
export const normalise = (raw) => {
    let text = flatten(raw);
    if (!text) return { text: '', tokens: [] };

    // Anything parenthesised or after a comma is a note, not the name.
    text = text.replace(/\([^)]*\)/g, ' ');
    if (text.includes(',')) text = text.split(',')[0];

    let words = text.split(' ').filter(Boolean);

    // Leading filler, quantities and units, from the front only.
    while (words.length && (LEADING_FILLER.has(words[0]) || isMeasure(words[0]))) {
        words.shift();
    }

    // Trailing filler ("...to taste", "...for serving", "...as needed").
    while (words.length && (PREP_WORDS.has(words[words.length - 1]) || LEADING_FILLER.has(words[words.length - 1]))) {
        words.pop();
    }

    words = words
        .filter((w) => !isMeasure(w) && !PREP_WORDS.has(w))
        .map((w) => SPELLINGS[w] || w)
        .flatMap((w) => w.split(' '))          // a spelling fix may expand to two words
        .map(singular);

    // Some phrases only resolve once the words are settled — "coriander leaf"
    // has to become "cilantro" after singularisation, not before.
    let joined = words.join(' ');
    for (const [from, to] of Object.entries(SYNONYMS)) {
        const key = normaliseShallow(from);
        if (joined === key) { joined = normaliseShallow(to); break; }
        // A synonym buried in a longer phrase still counts: "kashmiri deggi
        // mirch powder" should reach the chilli.
        if (key.includes(' ') && joined.includes(key)) { joined = normaliseShallow(to); break; }
    }

    return { text: joined, tokens: joined ? joined.split(' ') : [] };
};

/** Words as written, minus punctuation and plurals. No synonyms applied. */
const surfaceForm = (raw) => flatten(raw).split(' ').filter(Boolean).map(singular).join(' ');

/** The word-level half of normalise(), used to canonicalise the tables themselves. */
function normaliseShallow(raw) {
    return flatten(raw)
        .split(' ')
        .filter(Boolean)
        .map((w) => SPELLINGS[w] || w)
        .flatMap((w) => w.split(' '))
        .map(singular)
        .join(' ');
}

/* ---------- matching ----------------------------------------------------- */

/** How many trailing tokens two lists share. Culinary English puts the noun last. */
const commonSuffix = (a, b) => {
    let n = 0;
    while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
    return n;
};

/**
 * Does the line already say, in so many words, what it matched to? Used to
 * decide whether a resolution is worth explaining to the reader.
 */
const saysSo = (raw, item) => {
    // Deliberately *not* normalise(): that applies the synonym table, so
    // "deggi mirch" would already have been rewritten to "red chilli powder"
    // and every synonym would look like it had been said out loud. What matters
    // here is what the line literally says, before any translation.
    const said = surfaceForm(raw);
    const name = surfaceForm(item.name || item.label);
    if (!said || !name) return false;
    return said === name || said.includes(name);
};

/**
 * Dice coefficient over character bigrams: 1.0 identical, 0 nothing in common.
 *
 * Only used for *suggestions*, never for matching. When a line shares no words
 * at all with the pantry - "gochujang" against a cupboard that has never held
 * any - word-level scoring has nothing to say, and an empty suggestion list is
 * useless to someone trying to make a connection by hand. Character similarity
 * at least puts the plausible-looking names near the top.
 */
const dice = (a, b) => {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const grams = new Map();
    for (let i = 0; i < a.length - 1; i += 1) {
        const g = a.slice(i, i + 2);
        grams.set(g, (grams.get(g) || 0) + 1);
    }
    let shared = 0;
    for (let i = 0; i < b.length - 1; i += 1) {
        const g = b.slice(i, i + 2);
        const n = grams.get(g) || 0;
        if (n > 0) { grams.set(g, n - 1); shared += 1; }
    }
    return (2 * shared) / (a.length - 1 + b.length - 1);
};

/** Are all of `needle`'s tokens present in `hay`, in order? */
const isSubsequence = (needle, hay) => {
    let i = 0;
    for (const token of hay) {
        if (token === needle[i]) i += 1;
        if (i === needle.length) return true;
    }
    return needle.length === 0;
};

/**
 * Build a matcher over a pantry. Pre-normalises every row once, because a
 * recipe page can carry forty ingredient lines and the pantry is ~180 rows —
 * normalising inside the loop would be 7,000 passes per render.
 *
 * `pantry` is the array of rows from useIngredients (name, label, in_stock, …).
 */
export const buildMatcher = (pantry = []) => {
    const rows = (pantry || [])
        .filter((row) => row && (row.name || row.label))
        .map((row) => {
            const { text, tokens } = normalise(row.name || row.label);
            return { row, text, tokens };
        })
        .filter((entry) => entry.text);

    const exact = new Map();
    const remember = (key, entry) => {
        if (!key) return;
        // First writer wins, except that a stocked row beats an unstocked one -
        // this pantry has `cilantro`, `tomato`, `potato` and `heavy cream` each
        // filed twice under different categories, and picking the empty copy
        // would report a stocked ingredient as missing.
        const held = exact.get(key);
        if (!held || (!held.row.in_stock && entry.row.in_stock)) exact.set(key, entry);
    };

    for (const entry of rows) remember(entry.text, entry);

    // Aliases the pantry itself carries, taught by the user. They are indexed
    // after the real names and never overwrite one: an alias should be able to
    // reach an ingredient, not rename a different ingredient out of the way.
    for (const entry of rows) {
        for (const alias of entry.row.aliases || []) {
            const key = normalise(alias).text;
            if (key && !exact.has(key)) exact.set(key, entry);
        }
    }

    /**
     * Match one ingredient line.
     *
     * Returns { item, confidence, normalised, via } where confidence is one of
     * 'exact' | 'strong' | 'likely' | 'none'. Anything other than 'exact' is
     * worth showing the user, so they can see what was decided on their behalf.
     */
    const matchOne = (raw) => {
        const { text, tokens } = normalise(raw);
        if (!text) return { item: null, confidence: 'none', normalised: '', via: null };

        const hit = exact.get(text);
        if (hit) {
            return {
                item: hit.row,
                confidence: 'exact',
                normalised: text,
                via: hit.text,
                // An alias hit is exact, but it is exact *because she said so* -
                // worth distinguishing from a name that simply matched.
                byAlias: hit.text !== text,
            };
        }

        const best = rank(tokens)[0];

        if (!best || best.score < 0.45) {
            return { item: null, confidence: 'none', normalised: text, via: null };
        }

        return {
            item: best.entry.row,
            confidence: best.score >= 0.75 ? 'strong' : 'likely',
            normalised: text,
            via: best.entry.text,
        };
    };

    /**
     * Every pantry row this line has any claim on, best first.
     *
     * Shared with matchOne - the top of this list *is* the match - so the
     * shortlist offered when linking by hand is ranked by the same judgement
     * that failed to reach a conclusion on its own.
     */
    function rank(tokens) {
        const scored = [];

        for (const entry of rows) {
            const suffix = commonSuffix(tokens, entry.tokens);
            const contained = entry.tokens.length > 0 && isSubsequence(entry.tokens, tokens);

            // A shared tail of only form-words ("...powder", "...sauce") is not
            // evidence of anything. Require one real noun in the overlap.
            const overlap = entry.tokens.slice(entry.tokens.length - suffix);
            const meaningful = overlap.some((w) => !GENERIC_HEADS.has(w));
            const usable = (contained && entry.tokens.some((w) => !GENERIC_HEADS.has(w)))
                || (!contained && suffix > 0 && meaningful);

            let score;
            if (usable) {
                // How much of the pantry row the line accounts for - counted
                // over the *informative* words only.
                //
                // Counting all tokens made a short generic row beat a long
                // specific one: "shiitake mushrooms" covered all of `mushrooms`
                // but only two thirds of `dried shiitake mushrooms`, so the
                // generic row won despite sharing less that actually
                // identifies the ingredient. Ignoring form-words on both sides
                // makes `dried shiitake mushrooms` a complete cover instead.
                const informative = entry.tokens.filter((w) => !GENERIC_HEADS.has(w)).length;
                const matchedInformative = overlap.filter((w) => !GENERIC_HEADS.has(w)).length;
                const coverage = contained ? 1
                    : (informative ? matchedInformative / informative : suffix / entry.tokens.length);
                // Penalise a line that says far more than the pantry row does,
                // so "chicken stock powder" prefers a stock over plain
                // "chicken".
                const slack = Math.max(0, tokens.length - entry.tokens.length);
                score = coverage - slack * 0.06;
            } else {
                // Below anything matchOne would accept - kept only so the
                // hand-linking shortlist is never empty. Capped well under the
                // 0.45 threshold so it can never be mistaken for a match.
                score = Math.min(0.44, dice(tokens.join(' '), entry.text) * 0.4);
            }

            scored.push({
                entry,
                score,
                exactLength: Math.abs(tokens.length - entry.tokens.length),
                stocked: Boolean(entry.row.in_stock),
            });
        }

        return scored.sort((a, b) => (
            Math.abs(a.score - b.score) > 1e-9 ? b.score - a.score
                : a.stocked !== b.stocked ? (a.stocked ? -1 : 1)
                    : a.exactLength - b.exactLength
        ));
    }

    /**
     * The pantry rows most worth offering as a manual link for this line.
     *
     * The built-in synonym table can only ever be a guess at one person's
     * vocabulary. This is what makes it correctable: 176 rows is too many to
     * scroll, so the closest handful come first and typing filters the rest.
     */
    const suggest = (raw, limit = 6) => {
        const { text, tokens } = normalise(raw);
        if (!text) return [];
        return rank(tokens)
            .slice(0, limit)
            .map(({ entry, score }) => ({ item: entry.row, score }));
    };

    /**
     * Match a whole recipe's ingredient list and summarise it.
     * `ingredients` are the parsed rows ({ item, amount, unit, … }).
     */
    const matchRecipe = (ingredients = []) => {
        const lines = (ingredients || []).map((ing) => {
            const raw = ing?.item || ing?.name || '';
            const match = matchOne(raw);
            return {
                ...ing,
                raw,
                match: match.item,
                confidence: match.confidence,
                normalised: match.normalised,
                inStock: Boolean(match.item && match.item.in_stock),
                // Surfaced only when you could not work it out by reading the
                // line. "include a bay leaf" resolving to `bay leaf` needs no
                // explanation - the words are right there. "deggi mirch indian
                // chilli powder" resolving to `red chilli powder` does, and so
                // does any match the matcher was less than sure about.
                resolvedAs: match.item && (match.confidence === 'likely' || !saysSo(raw, match.item))
                    ? (match.item.label || match.item.name)
                    : null,
            };
        });

        const stocked = lines.filter((l) => l.inStock).length;
        const missing = lines.filter((l) => !l.match);
        const outOfStock = lines.filter((l) => l.match && !l.inStock);

        return {
            lines,
            missing,
            outOfStock,
            total: lines.length,
            percent: lines.length ? Math.round((stocked / lines.length) * 100) : 0,
        };
    };

    return { matchOne, matchRecipe, suggest, size: rows.length };
};

/* ---------- guessing a home for something new ---------------------------- */

const CATEGORY_HINTS = [
    [/\b(powder|masala|seed|peppercorn|chilli|cardamom|cinnamon|clove|cumin|coriander|turmeric|paprika|nutmeg|salt|pepper|extract|hing|amchur|methi|saffron|bay leaf|oregano|cayenne)\b/, 'Spices'],
    [/\b(milk|cream|butter|cheese|yogurt|paneer|ricotta|parmesan|mozzarella|ghee|curd)\b/, 'Dairy'],
    [/\b(chicken|beef|pork|lamb|fish|shrimp|prawn|crab|tofu|egg|mutton|bacon|sausage|salmon|tuna)\b/, 'Protein'],
    [/\b(onion|garlic|ginger|tomato|potato|carrot|pepper|lettuce|spinach|herb|basil|mint|cilantro|parsley|lemon|lime|apple|leaf|leaves|mushroom|cucumber|cabbage|greens|chive|scallion)\b/, 'Produce'],
];

const CATEGORY_ICON = {
    Spices: '🌶️', Dairy: '🥛', Protein: '🍗', Produce: '🥬', Pantry: '🫙',
};

/**
 * A sensible category and icon for an ingredient the pantry has never seen, so
 * bulk-adding a recipe's misses does not dump thirty rows into "Uncategorized".
 */
export const guessCategory = (raw) => {
    const { text } = normalise(raw);
    for (const [pattern, category] of CATEGORY_HINTS) {
        if (pattern.test(text)) return category;
    }
    return 'Pantry';
};

export const iconFor = (category) => CATEGORY_ICON[category] || '🫙';

/** Title-ish label for a new row: the normalised name is the honest one. */
export const labelFor = (raw) => {
    const { text } = normalise(raw);
    if (!text) return String(raw || '').trim();
    return text.replace(/\b[a-z]/g, (c) => c.toUpperCase());
};
