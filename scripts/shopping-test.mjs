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

console.log(`\nshoppingList: ${n} passed`);
