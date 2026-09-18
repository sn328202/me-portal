import assert from 'node:assert/strict';
import { plannedFrom, listAsText, stillToBuy } from '../src/utils/shoppingList.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

/* A matcher that knows three things, the way the real one knows 756. */
const KNOWN = {
    garlic: { id: 'garlic', label: 'Garlic' },
    basil: { id: 'basil', label: 'Basil' },
    butter: { id: 'butter', label: 'Butter' },
};
const matcher = {
    matchOne: (raw) => {
        const normalised = String(raw || '').toLowerCase().trim();
        const hit = Object.keys(KNOWN).find((k) => normalised.includes(k));
        return hit ? { item: KNOWN[hit], normalised } : { item: null, normalised };
    },
};

const RECIPES = [
    { id: 1, title: 'Beet pasta', ingredients: [
        { item: 'garlic cloves', amount: '4', unit: '' },
        { item: 'fresh basil', amount: '1', unit: 'handful' },
        { item: 'rigatoni', amount: '0.5', unit: 'lb' },
    ] },
    { id: 2, title: 'Garlic bread', ingredients: [
        { item: 'garlic', amount: '2', unit: '' },
        { item: 'butter', amount: '200', unit: 'g' },
        { item: 'butter', amount: '2', unit: 'tbsp' },
    ] },
];
const PLAN = { mon: [1], tue: [2] };

console.log('what the meal plan implies:');

t('the same thing from two recipes is one line', () => {
    // Four cloves in the pasta and two in the bread is six cloves, once.
    const list = plannedFrom({ plan: PLAN, recipes: RECIPES, matcher });
    const garlic = list.find((i) => i.label === 'Garlic');
    assert.equal(garlic.amount, 6);
    assert.equal(list.filter((i) => i.label === 'Garlic').length, 1);
});

t('but the same thing in two units is two lines', () => {
    // 200g of butter and 2 tbsp of butter are the same shop, not the same
    // number, and adding them would produce 202 of nothing.
    const list = plannedFrom({ plan: PLAN, recipes: RECIPES, matcher });
    const butter = list.filter((i) => i.label === 'Butter');
    assert.deepEqual(butter.map((b) => [b.amount, b.unit]).sort(), [[2, 'tbsp'], [200, 'g']]);
});

t('something the matcher has never heard of still gets bought', () => {
    const list = plannedFrom({ plan: PLAN, recipes: RECIPES, matcher });
    assert.ok(list.some((i) => i.label === 'rigatoni'), 'unmatched lines are not dropped');
});

t('what is in the cupboard falls to the bottom', () => {
    const list = plannedFrom({ plan: PLAN, recipes: RECIPES, matcher, pantryStock: { garlic: true } });
    assert.equal(list.at(-1).label, 'Garlic');
    assert.equal(list.at(-1).inStock, true);
    assert.equal(list[0].inStock, false);
});

t('an amount that is not a number does not poison the total', () => {
    const odd = [{ id: 9, ingredients: [
        { item: 'basil', amount: 'a handful', unit: '' },
        { item: 'basil', amount: '2', unit: '' },
    ] }];
    const list = plannedFrom({ plan: { mon: [9] }, recipes: odd, matcher });
    assert.equal(list[0].amount, 2);
});

t('no plan is an empty list, not a crash', () => {
    assert.deepEqual(plannedFrom({}), []);
    assert.deepEqual(plannedFrom(), []);
    assert.deepEqual(plannedFrom({ plan: { mon: [404] }, recipes: RECIPES, matcher }), []);
});

console.log('\nthe list, to take to a shop:');

const ITEMS = [
    { id: 'a', text: 'Milk', checked: false },
    { id: 'b', text: 'Bin bags', checked: true },
];

t('ticked things and pantry things are both left out', () => {
    // A line you do not need is a line you read past holding a basket.
    const planned = plannedFrom({ plan: PLAN, recipes: RECIPES, matcher, pantryStock: { garlic: true } });
    const text = listAsText({ items: ITEMS, planned });
    assert.match(text, /- \[ \] Milk/);
    assert.equal(text.includes('Bin bags'), false);
    assert.equal(text.includes('Garlic'), false);
    assert.match(text, /Butter/);
});

t('amounts come through, and nothing says "0 of"', () => {
    const planned = [{ key: 'x', label: 'Basil', amount: 0, unit: '', inStock: false }];
    assert.match(listAsText({ items: [], planned }), /- \[ \] Basil\n/);
});

t('and it counts what is still to buy', () => {
    const planned = plannedFrom({ plan: PLAN, recipes: RECIPES, matcher, pantryStock: { garlic: true } });
    // Milk, plus everything planned that is not garlic.
    assert.equal(stillToBuy(ITEMS, planned), 1 + planned.filter((p) => !p.inStock).length);
    assert.equal(stillToBuy(), 0);
});


/* --- one list, not two -------------------------------------------------- */
const { mergeList, byAisle, aisleOf, faceOf } = await import('../src/utils/shoppingList.js');

const CAT = {
    garlic: { id: 'garlic', label: 'Garlic', category: 'Produce' },
    basil: { id: 'basil', label: 'Basil', category: 'Produce' },
    butter: { id: 'butter', label: 'Butter', category: 'Dairy' },
};
const cat = {
    matchOne: (raw) => {
        const normalised = String(raw || '').toLowerCase().trim();
        const hit = Object.keys(CAT).find((k) => normalised.includes(k));
        return hit ? { item: CAT[hit], normalised } : { item: null, normalised };
    },
};

console.log('\nthe typed half and the cooked half are one list:');

t('the same thing from both sides is one line', () => {
    /* The Larder kept them apart and never compared them, so "garlic" typed by
       hand and "4 cloves garlic" from a recipe were two lines in two places —
       and buying twice is what a shopping list exists to prevent. */
    const planned = plannedFrom({ plan: PLAN, recipes: RECIPES, matcher: cat });
    const merged = mergeList({
        items: [{ id: 'm1', text: 'garlic', checked: false }],
        planned,
        matcher: cat,
    });
    const garlic = merged.filter((l) => /garlic/i.test(l.label));
    assert.equal(garlic.length, 1);
    assert.equal(garlic[0].amount, 6, 'and it carries the recipes’ amount');
    assert.equal(garlic[0].itemId, 'm1', 'while staying the row she can tick');
});

t('her words win the label', () => {
    // A thing she wrote down should read back as she wrote it.
    const merged = mergeList({
        items: [{ id: 'm1', text: 'the good garlic', checked: false }],
        planned: plannedFrom({ plan: PLAN, recipes: RECIPES, matcher: cat }),
        matcher: cat,
    });
    assert.ok(merged.some((l) => l.label === 'the good garlic'));
});

t('and it says which recipes wanted it', () => {
    const planned = plannedFrom({ plan: PLAN, recipes: RECIPES, matcher: cat });
    const garlic = planned.find((l) => l.label === 'Garlic');
    assert.deepEqual(garlic.notes, ['Beet pasta', 'Garlic bread']);
});

t('something typed that matches nothing still gets a line', () => {
    const merged = mergeList({ items: [{ id: 'm9', text: 'birthday candles' }], planned: [], matcher: cat });
    assert.equal(merged.length, 1);
    assert.equal(merged[0].label, 'birthday candles');
});

console.log('\nlaid out like a shop:');

t('aisles in the order you walk them, not A to Z', () => {
    // Sorted alphabetically it sends you back across the shop for the yoghurt.
    const merged = mergeList({
        items: [],
        planned: plannedFrom({ plan: PLAN, recipes: RECIPES, matcher: cat }),
        matcher: cat,
    });
    const { aisles } = byAisle(merged);
    const names = aisles.map((a) => a.name);
    assert.equal(names.indexOf('Produce') < names.indexOf('Dairy'), true);
});

t('and anything unmatched goes to the end, not into Produce', () => {
    assert.equal(aisleOf({ category: '' }), 'Anything else');
    assert.equal(aisleOf({}), 'Anything else');
    const { aisles } = byAisle([
        { key: 'a', label: 'Candles', category: '' },
        { key: 'b', label: 'Basil', category: 'Produce' },
    ]);
    assert.equal(aisles.at(-1).name, 'Anything else');
});

t('what she already has drops out of the walk', () => {
    // Worth seeing once, not worth walking for.
    const { aisles, have, needed } = byAisle([
        { key: 'a', label: 'Garlic', category: 'Produce', inStock: true },
        { key: 'b', label: 'Basil', category: 'Produce' },
        { key: 'c', label: 'Butter', category: 'Dairy', checked: true },
    ]);
    assert.equal(needed, 1);
    assert.deepEqual(aisles.map((x) => x.name), ['Produce']);
    assert.deepEqual(aisles[0].lines.map((l) => l.label), ['Basil']);
    assert.deepEqual(have.map((l) => l.label).sort(), ['Butter', 'Garlic']);
});

t('every aisle carries a face', () => {
    // Read at arm's length in a shop: the shape lands before the word does.
    const { aisles } = byAisle([
        { key: 'a', label: 'Basil', category: 'Produce' },
        { key: 'b', label: 'Butter', category: 'Dairy' },
        { key: 'c', label: 'Candles', category: '' },
    ]);
    assert.deepEqual(aisles.map((x) => x.face), ['\u{1F96C}', '\u{1F9C0}', '\u{1F9FA}']);
    assert.ok(aisles.every((x) => x.face && [...x.face].length === 1));
});

t('an aisle the app has never heard of still gets one', () => {
    // Her pantry categories are hers to name, and a blank where a face should
    // be reads as a broken image rather than as a category with no picture.
    assert.equal(faceOf('Cheese counter'), '\u{1F4CE}');
    assert.equal(faceOf(''), '\u{1F4CE}');
});

console.log('\ncopied, it still knows the aisles:');

t('the copy is laid out in sections, not one flat run', () => {
    /* It used to paste as two blocks — what she typed, then what the plan
       implied — which is neither what you read in a shop nor what you hand
       to someone else. */
    const text = listAsText({
        items: [{ id: 'm1', text: 'Milk', checked: false }],
        planned: plannedFrom({ plan: PLAN, recipes: RECIPES, matcher: cat }),
        matcher: cat,
    });
    assert.match(text, /SHOPPING LIST/);
    assert.match(text, /PRODUCE/);
    assert.match(text, /DAIRY/);
    assert.equal(text.includes('FROM THE HEARTH'), false, 'the old two-block shape is gone');
});

t('each line sits under the aisle it belongs to', () => {
    const text = listAsText({
        items: [],
        planned: plannedFrom({ plan: PLAN, recipes: RECIPES, matcher: cat }),
        matcher: cat,
    });
    const section = (name) => text.split(/\n\n/).find((b) => b.includes(name)) || '';
    assert.match(section('PRODUCE'), /Basil/);
    assert.match(section('DAIRY'), /Butter/);
    assert.equal(section('PRODUCE').includes('Butter'), false);
});

t('and the sections come in the order you walk them', () => {
    const text = listAsText({
        items: [{ id: 'm1', text: 'birthday candles' }],
        planned: plannedFrom({ plan: PLAN, recipes: RECIPES, matcher: cat }),
        matcher: cat,
    });
    assert.ok(text.indexOf('PRODUCE') < text.indexOf('DAIRY'));
    assert.ok(text.indexOf('DAIRY') < text.indexOf('ANYTHING ELSE'), 'unmatched last');
});

t('every heading carries its face', () => {
    const text = listAsText({ items: [], planned: [{ key: 'b', label: 'Basil', category: 'Produce' }] });
    assert.match(text, /\u{1F96C} PRODUCE/u);
});

t('what is typed and what is cooked are one line in the copy too', () => {
    const text = listAsText({
        items: [{ id: 'm1', text: 'garlic', checked: false }],
        planned: plannedFrom({ plan: PLAN, recipes: RECIPES, matcher: cat }),
        matcher: cat,
    });
    assert.equal(text.match(/garlic/gi).length, 1, 'one garlic, not two');
    assert.match(text, /- \[ \] 6 garlic/);
});

t('a ticked line and a pantry line are both left out of the copy', () => {
    const text = listAsText({
        items: [{ id: 'm1', text: 'Bin bags', checked: true }],
        planned: plannedFrom({ plan: PLAN, recipes: RECIPES, matcher: cat, pantryStock: { garlic: true } }),
        matcher: cat,
        pantryStock: { garlic: true },
    });
    assert.equal(text.includes('Bin bags'), false);
    assert.equal(/garlic/i.test(text), false);
});

t('an empty list says so rather than pasting a bare heading', () => {
    assert.match(listAsText({ items: [], planned: [] }), /Nothing to buy/);
});

console.log('\ntwo units is two lines, all the way to the basket:');

t('200g of butter and 2 tbsp of butter do not become 202 of nothing', () => {
    /* plannedFrom had always kept them apart; mergeList keyed on the
       ingredient alone and added them back together, and the page showed
       "202 g Butter". */
    const merged = mergeList({
        items: [],
        planned: plannedFrom({ plan: PLAN, recipes: RECIPES, matcher: cat }),
        matcher: cat,
    });
    const butter = merged.filter((l) => l.label === 'Butter');
    assert.deepEqual(butter.map((b) => [b.amount, b.unit]).sort(), [[2, 'tbsp'], [200, 'g']]);
});

t('a line she typed adopts the first unit, and does not then split', () => {
    // "butter" typed by hand, then 200g from one recipe and 100g from another:
    // one line of 300g, not a 200 and a 100.
    const merged = mergeList({
        items: [{ id: 'm1', text: 'butter', checked: false }],
        planned: [
            { key: 'p1', label: 'Butter', amount: 200, unit: 'g', ingredientId: 'butter', notes: [] },
            { key: 'p2', label: 'Butter', amount: 100, unit: 'g', ingredientId: 'butter', notes: [] },
        ],
        matcher: cat,
    });
    const butter = merged.filter((l) => /butter/i.test(l.label));
    assert.equal(butter.length, 1);
    assert.equal(butter[0].amount, 300);
    assert.equal(butter[0].unit, 'g');
    assert.equal(butter[0].itemId, 'm1', 'and it is still the row she can tick');
});

t('the same thing written down twice is still one line', () => {
    const merged = mergeList({
        items: [{ id: 'm1', text: 'Garlic' }, { id: 'm2', text: 'garlic' }],
        planned: [],
        matcher: cat,
    });
    assert.equal(merged.length, 1);
    assert.equal(merged[0].label, 'Garlic', 'the first spelling is the one she will recognise');
});

console.log(`\nshoppingList: ${n} passed`);
