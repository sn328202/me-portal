import { readFile } from 'node:fs/promises';
/**
 * Unit checks for the capture endpoint's duplicate guard.
 *
 * The guard is the one piece that can silently refuse a legitimate item, which
 * is a worse failure than the duplicates it exists to prevent. These cases pin
 * both directions: what must collapse, and what must stay distinct.
 */
import { norm, dedupe, describeDupes, TOOLS, loadContext, systemPrompt } from '../api/capture.js';

let failed = 0;
const check = (label, actual, expected) => {
    const ok = actual === expected;
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
};

console.log('\nnorm() — these must collapse to the same key:');
const same = [
    ['lemon', 'lemons'],
    ['oat milk', 'Oat Milk'],
    ['ricotta', 'the ricotta'],
    ['tomato', 'tomatoes'],
    ['berry', 'berries'],
    ['gochujang', 'Gochujang!'],
    ['creme fraiche', 'crème fraîche'],
    ['bread', 'some more bread'],
];
same.forEach(([a, b]) => check(`${JSON.stringify(a)} == ${JSON.stringify(b)}`, norm(a), norm(b)));

console.log('\nnorm() — these must stay distinct:');
const diff = [
    ['asparagus', 'asparagu'],
    ['glass', 'glas'],
    ['pasta', 'pesto'],
    ['oat milk', 'almond milk'],
    ['bus', 'bu'],
];
diff.forEach(([a, b]) => check(`${JSON.stringify(a)} != ${JSON.stringify(b)}`, norm(a) !== norm(b), true));

console.log('\ndedupe() — behaviour:');
{
    const ctx = { index: { provisions: new Set(['oat milk', 'pasta'].map(norm)) } };
    const dupes = [];
    const fresh = dedupe(ctx, 'provisions', ['Lemons', 'pasta', 'oat milk', 'corn'], 'on your grocery list', dupes);
    check('lets new items through', fresh.join('|'), 'Lemons|corn');
    check('refuses what already exists', dupes.map((d) => d.item).join('|'), 'pasta|oat milk');
}
{
    const ctx = { index: {} };
    const dupes = [];
    const fresh = dedupe(ctx, 'provisions', ['eggs', 'milk', 'Eggs'], 'on your grocery list', dupes);
    check('catches repeats inside one utterance', fresh.join('|'), 'eggs|milk');
    check('  and reports the repeat', dupes.length, 1);
}
{
    const ctx = { index: {} };
    const dupes = [];
    dedupe(ctx, 'provisions', ['', '   ', null, undefined], 'on your grocery list', dupes);
    check('ignores empty values entirely', dupes.length, 0);
}

console.log('\ndescribeDupes() — phrasing:');
check('single item', describeDupes([{ item: 'pasta', where: 'on your grocery list' }]),
    'pasta was already on your grocery list');
check('two in one place', describeDupes([
    { item: 'pasta', where: 'on your grocery list' },
    { item: 'corn', where: 'on your grocery list' },
]), 'pasta and corn were already on your grocery list');
check('across places', describeDupes([
    { item: 'pasta', where: 'on your grocery list' },
    { item: 'Rome', where: 'in the Atlas' },
]), 'pasta was already on your grocery list; Rome was already in the Atlas');
check('nothing', describeDupes([]), null);


/* --- running out is two facts ------------------------------------------
   The shortcut only ever recorded the second one: "we are out of garlic and
   milk" put both on the grocery list and left the pantry claiming she had
   them. These pin the shape of the fix without a database. */

console.log('\nran_out — the tool the shortcut was missing:');

const tool = (n) => TOOLS.find((t) => t.name === n);

check('there is a tool for it', !!tool('ran_out'), true);
check('it takes a list, like the grocery one does',
    tool('ran_out')?.input_schema?.properties?.items?.type, 'array');
check('and its description says it does both',
    /out of stock.*grocery list|grocery list.*out of stock/is.test(tool('ran_out')?.description || ''), true);
check('so the model is told not to also add them to the list',
    /not also call add_groceries|one call, not two/i.test(tool('ran_out')?.description || ''), true);
check('and restocking says it can put something back',
    /back in stock|out of stock/i.test(tool('add_pantry_item')?.description || ''), true);


/* The pantry is now written to, not only read from, and that changes what the
   context query has to fetch. It selected `name, label, in_stock` — no `id` —
   so the first restock ran an update with nothing to aim at and the whole
   dictation came back "every write failed". */
console.log('\nthe pantry context, now that it is written to:');

const loader = loadContext.toString();
const pantryQuery = (loader.match(/q\('pantry_ingredients'[^)]*\)/) || [''])[0];

check('the pantry query fetches ids', /\bid\b/.test(pantryQuery), true);
check('and every ingredient, not the newest handful',
    Number((pantryQuery.match(/limit:\s*(\d+)/) || [])[1] || 0) >= 400, true);


/* ---- the wardrobe ---------------------------------------------------- */

console.log('\ndictating a closet:');

{
    const tools = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

    check('there is a tool for clothes she already owns', Boolean((tools.add_garment)), true);
    check('and one for outfits', Boolean((tools.add_outfit)), true);

    // The whole complaint: clothes were landing in the Treasury, which is a
    // list of things she wants to buy.
    /* Every list the prompt reads, all empty. A missing key is a crash rather
       than an empty section, which is worth knowing on its own. */
    const empty = {
        index: {}, days: [], trips: [], treasury: [], treasuryCategories: [],
        library: [], rooms: [], pantry: [], pantryOut: [], pantryBy: new Map(),
        groceries: [], todos: [], goals: [], habits: [], social: [], recipes: [],
        ideas: [], closet: [], looks: [], sharedPost: null,
    };
    const prompt = systemPrompt(empty, new Date('2026-09-03T09:00:00Z'));
    check('the prompt draws the line between owning and wanting', Boolean(/Owning is not wanting/.test(prompt)), true);
    check('and names both tools where it draws it', Boolean(/add_garment/.test(prompt) && /add_desire/.test(prompt)), true);
    check('the Wardrobe is listed as a room', Boolean(/\*\*Wardrobe\*\*/.test(prompt)), true);

    // A garment filed under a category the planner does not know is a garment
    // that appears on no screen, and nothing anywhere reports it.
    const cat = tools.add_garment.input_schema.properties.garments.items.properties.category;
    check('a garment must carry a category', Boolean(tools.add_garment.input_schema.properties.garments.items.required.includes('category')), true);
    check('and it can only be one the planner draws',
        JSON.stringify(cat.enum),
        JSON.stringify(['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Swimwear']));

    // Dictating a wardrobe is dozens of garments. One call each would be absurd.
    check('garments arrive many at a time', Boolean(tools.add_garment.input_schema.properties.garments.type === 'array'), true);
}

console.log('\nbackticks in the prompt:');

{
    // Twice now a backtick inside the prompt's template literal has broken
    // this whole file at parse time — once for `ran_out`, once for `category`.
    // The module importing at all proves it today; this says why out loud so
    // the next person reaches for ** rather than ` .
    const src = await readFile(new URL('../api/capture.js', import.meta.url), 'utf8');
    const promptBody = src.slice(src.indexOf('const systemPrompt'));
    const literal = promptBody.slice(promptBody.indexOf('`'), promptBody.indexOf('# How to file'));
    check('the prompt uses ** for emphasis, never a backtick', Boolean(!/\n[^\n]*`[a-z_]+`/.test(literal)), true);
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
