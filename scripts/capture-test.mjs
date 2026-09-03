/**
 * Unit checks for the capture endpoint's duplicate guard.
 *
 * The guard is the one piece that can silently refuse a legitimate item, which
 * is a worse failure than the duplicates it exists to prevent. These cases pin
 * both directions: what must collapse, and what must stay distinct.
 */
import { norm, dedupe, describeDupes, TOOLS } from '../api/capture.js';

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

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
