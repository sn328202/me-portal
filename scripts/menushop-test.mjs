import assert from 'node:assert/strict';
import {
    parseAmount, formatAmount, menuShopping, amountText, shopOf,
    setMultiplier, swapLine, removeLine, undoChange, addExtra, toggleGot, toggleAlso, menuListAsText,
} from '../src/utils/menuShopping.js';
import { byAisle } from '../src/utils/shoppingList.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

const KNOWN = {
    'heavy cream': { id: 'cream', label: 'Heavy cream', category: 'Dairy' },
    'beef stock': { id: 'beefstock', label: 'Beef stock', category: 'Pantry' },
    'chicken stock': { id: 'chickenstock', label: 'Chicken stock', category: 'Pantry' },
    garlic: { id: 'garlic', label: 'Garlic', category: 'Produce' },
    butter: { id: 'butter', label: 'Butter', category: 'Dairy' },
    egg: { id: 'egg', label: 'Eggs', category: 'Dairy' },
};
const matcher = {
    matchOne: (raw) => {
        const normalised = String(raw || '').toLowerCase().trim();
        const hit = Object.keys(KNOWN).find((k) => normalised.includes(k));
        return hit ? { item: KNOWN[hit], normalised } : { item: null, normalised };
    },
};

const RECIPES = [
    { id: 'chicken', title: 'Chicken au poivre', ingredients: [
        { item: 'heavy cream', amount: '2', unit: 'cups' },
        { item: 'garlic cloves', amount: '5', unit: '' },
        { item: 'whole peppercorns', amount: '1.5', unit: 'tablespoons' },
    ] },
    { id: 'dauph', title: 'Dauphinoise', ingredients: [
        { item: 'heavy cream', amount: '1 3/4', unit: 'cups' },
        { item: 'beef stock', amount: '1', unit: 'cup' },
        { item: 'garlic', amount: '4', unit: '' },
        { item: 'salt', amount: 'to taste', unit: '' },
    ] },
    { id: 'cake', title: 'Princess cake', ingredients: [
        { item: 'heavy cream', amount: '2', unit: 'cups' },
        { item: 'eggs', amount: '3', unit: '' },
        { item: 'unsalted butter', amount: '½', unit: 'cup' },
    ] },
];

const thanksgiving = (shop = {}) => ({
    id: 'tg',
    title: 'Thanksgiving',
    shop,
    user_larder_menu_recipes: [
        { recipe_id: 'chicken', course_name: 'Main Course' },
        { recipe_id: 'dauph', course_name: 'Side' },
        { recipe_id: null, item_name: 'Lambrusco', item_note: '2-3 bottles', course_name: 'Drinks' },
    ],
});
const birthday = (shop = {}) => ({
    id: 'bday',
    title: "Mom's birthday",
    shop,
    user_larder_menu_recipes: [{ recipe_id: 'cake', course_name: 'Dessert' }],
});

const find = (lines, label) => lines.find((l) => l.label === label);

console.log('amounts:');

t('fractions, mixed numbers and vulgar fractions all read as numbers', () => {
    assert.equal(parseAmount('1/2'), 0.5);
    assert.equal(parseAmount('1 3/4'), 1.75);
    assert.equal(parseAmount('2½'), 2.5);
    assert.equal(parseAmount('½'), 0.5);
    assert.equal(parseAmount('1.5'), 1.5);
    assert.equal(parseAmount(3), 3);
});

t('a range is bought at its top', () => {
    assert.equal(parseAmount('4-6'), 6);
    assert.equal(parseAmount('4 to 6'), 6);
});

t('words are not numbers', () => {
    assert.equal(parseAmount('to taste'), null);
    assert.equal(parseAmount(''), null);
    assert.equal(parseAmount('a pinch'), null);
});

t('numbers read back the way a kitchen writes them', () => {
    assert.equal(formatAmount(1.5), '1 1/2');
    assert.equal(formatAmount(0.333333), '1/3');
    assert.equal(formatAmount(7.75), '7 3/4');
    assert.equal(formatAmount(4), '4');
    assert.equal(formatAmount(0.99), '1');
    assert.equal(formatAmount(0), '');
});

console.log('one menu:');

t('the same ingredient from two dishes is one line, added up', () => {
    const { lines } = menuShopping({ menus: [thanksgiving()], recipes: RECIPES, matcher });
    const garlic = find(lines, 'Garlic');
    assert.equal(garlic.amount, 9);
    assert.deepEqual(garlic.notes, ['Chicken au poivre', 'Dauphinoise']);
});

t('a dish made twice doubles only its own share', () => {
    const shop = setMultiplier({}, 'chicken', 2);
    const { lines } = menuShopping({ menus: [thanksgiving(shop)], recipes: RECIPES, matcher });
    assert.equal(find(lines, 'Garlic').amount, 14); // 5 x 2 + 4
    assert.ok(find(lines, 'Garlic').notes.includes('Chicken au poivre ×2'));
    const cream = lines.filter((l) => l.label === 'Heavy cream');
    // 2 cups x 2 + 1 3/4 cups
    assert.equal(cream.find((l) => l.unit === 'cups').amount, 5.75);
});

t('a multiplier of 1 is not stored', () => {
    const shop = setMultiplier(setMultiplier({}, 'chicken', 2), 'chicken', 1);
    assert.deepEqual(shop.multipliers, {});
});

t('an amount that is not a number is kept as words', () => {
    const { lines } = menuShopping({ menus: [thanksgiving()], recipes: RECIPES, matcher });
    assert.equal(amountText(find(lines, 'salt')), 'to taste');
});

t('things bought rather than cooked are on the list with their note', () => {
    const { lines } = menuShopping({ menus: [thanksgiving()], recipes: RECIPES, matcher });
    const wine = find(lines, 'Lambrusco');
    assert.equal(amountText(wine), '2-3 bottles');
    assert.equal(wine.category, 'Drinks');
});

console.log('swaps and removals:');

t('a swap changes what is bought, keeps the amount, and says what it replaced', () => {
    let { lines } = menuShopping({ menus: [thanksgiving()], recipes: RECIPES, matcher });
    const shop = swapLine({}, 'tg', find(lines, 'Beef stock'), 'homemade chicken stock');
    ({ lines } = menuShopping({ menus: [thanksgiving(shop)], recipes: RECIPES, matcher }));
    assert.equal(find(lines, 'Beef stock'), undefined);
    const stock = find(lines, 'homemade chicken stock');
    assert.equal(stock.amount, 1);
    assert.equal(stock.unit, 'cup');
    assert.equal(stock.swappedFrom, 'beef stock');
});

t('removing a line drops it from this menu and lists it as a change', () => {
    let { lines } = menuShopping({ menus: [thanksgiving()], recipes: RECIPES, matcher });
    const shop = removeLine({}, 'tg', find(lines, 'Lambrusco'));
    let changes;
    ({ lines, changes } = menuShopping({ menus: [thanksgiving(shop)], recipes: RECIPES, matcher }));
    assert.equal(find(lines, 'Lambrusco'), undefined);
    assert.deepEqual(changes.map((c) => [c.kind, c.from]), [['removed', 'Lambrusco']]);
});

t('a change can be undone', () => {
    let { lines } = menuShopping({ menus: [thanksgiving()], recipes: RECIPES, matcher });
    let shop = removeLine({}, 'tg', find(lines, 'Garlic'));
    const key = Object.keys(shop.removed)[0];
    shop = undoChange(shop, key);
    ({ lines } = menuShopping({ menus: [thanksgiving(shop)], recipes: RECIPES, matcher }));
    assert.equal(find(lines, 'Garlic').amount, 9);
});

t('extras are bought, and removing one deletes it', () => {
    let shop = addExtra({}, '4 disposable roasting pans', 'pans');
    let { lines } = menuShopping({ menus: [thanksgiving(shop)], recipes: RECIPES, matcher });
    const pans = find(lines, '4 disposable roasting pans');
    assert.ok(pans);
    shop = removeLine(shop, 'tg', pans);
    ({ lines } = menuShopping({ menus: [thanksgiving(shop)], recipes: RECIPES, matcher }));
    assert.equal(find(lines, '4 disposable roasting pans'), undefined);
});

console.log('two menus, one trip:');

t('another menu adds its dishes to the same lines', () => {
    const shop = setMultiplier({}, 'chicken', 2);
    const { lines } = menuShopping({ menus: [thanksgiving(shop), birthday()], recipes: RECIPES, matcher });
    const cream = lines.find((l) => l.label === 'Heavy cream' && l.unit === 'cups');
    assert.equal(cream.amount, 7.75);
    assert.ok(cream.notes.includes('Princess cake'));
});

t("a swap on one menu does not touch the other menu's dishes", () => {
    const base = menuShopping({ menus: [thanksgiving()], recipes: RECIPES, matcher }).lines;
    const shop = swapLine({}, 'tg', base.find((l) => l.label === 'Heavy cream' && l.unit === 'cups'), 'half and half');
    const { lines } = menuShopping({ menus: [thanksgiving(shop), birthday()], recipes: RECIPES, matcher });
    assert.equal(find(lines, 'half and half').amount, 3.75);
    assert.equal(lines.find((l) => l.label === 'Heavy cream' && l.unit === 'cups').amount, 2);
});

t('the other menu keeps its own multipliers', () => {
    const cake = birthday(setMultiplier({}, 'cake', 2));
    const { lines } = menuShopping({ menus: [thanksgiving(), cake], recipes: RECIPES, matcher });
    assert.equal(find(lines, 'Eggs').amount, 6);
});

t('menus shopped alongside are toggled on and off', () => {
    let shop = toggleAlso({}, 'bday');
    assert.deepEqual(shop.also, ['bday']);
    shop = toggleAlso(shop, 'bday');
    assert.deepEqual(shop.also, []);
});

console.log('the pantry and the basket:');

t('what is in the pantry is counted unless she says to buy everything', () => {
    const stock = { garlic: true };
    let { lines } = menuShopping({ menus: [thanksgiving()], recipes: RECIPES, matcher, pantryStock: stock });
    assert.equal(find(lines, 'Garlic').inStock, true);
    ({ lines } = menuShopping({ menus: [thanksgiving({ pantry: false })], recipes: RECIPES, matcher, pantryStock: stock }));
    assert.equal(find(lines, 'Garlic').inStock, false);
});

t('ticked lines move out of the walk', () => {
    const first = menuShopping({ menus: [thanksgiving()], recipes: RECIPES, matcher }).lines;
    const shop = toggleGot({}, find(first, 'Garlic').key);
    const { lines } = menuShopping({ menus: [thanksgiving(shop)], recipes: RECIPES, matcher });
    const { aisles, have } = byAisle(lines);
    assert.ok(have.some((l) => l.label === 'Garlic'));
    assert.ok(!aisles.flatMap((a) => a.lines).some((l) => l.label === 'Garlic'));
});

t('settings saved by an older version still load', () => {
    const s = shopOf({ shop: { multipliers: { a: 2 } } });
    assert.deepEqual(s.extras, []);
    assert.equal(s.pantry, true);
    assert.deepEqual(shopOf(null).also, []);
});

t('the copied text groups by aisle with amounts and dishes', () => {
    const { lines } = menuShopping({ menus: [thanksgiving()], recipes: RECIPES, matcher });
    const text = menuListAsText({ title: 'Thanksgiving', aisles: byAisle(lines).aisles });
    assert.ok(text.startsWith('Thanksgiving\n'));
    assert.ok(text.includes('PRODUCE'));
    assert.ok(text.includes('- [ ] 9 Garlic (Chicken au poivre, Dauphinoise)'));
});

console.log(`\n${n} passed`);
