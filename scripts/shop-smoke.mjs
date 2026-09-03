// Ad-hoc smoke test for the Larder's Provisions tab.
//
// The unit tests in shopping-test.mjs prove the merge; this proves the page
// actually renders it - that the tab switches, the aisles draw in walk order,
// a hand-typed line and a recipe line that mean the same thing come out as one
// row, and what is already in the pantry leaves the walk.
//
// Supabase is answered from fixtures here rather than reached, so this needs
// no network and no account. Run with: npm run build && npm run preview, then
//   CHROME_PATH=... node scripts/shop-smoke.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const REF = 'example';
const UID = '00000000-0000-4000-8000-000000000001';

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
const fakeJwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub: UID, email: 'smoke@test.local', role: 'authenticated', exp,
})}.sig`;
const session = {
    access_token: fakeJwt, refresh_token: 'fake-refresh', expires_at: exp,
    expires_in: 86400, token_type: 'bearer',
    user: {
        id: UID, email: 'smoke@test.local', aud: 'authenticated',
        role: 'authenticated', app_metadata: {}, user_metadata: {},
        created_at: new Date(0).toISOString(),
    },
};

const today = new Date().toISOString().slice(0, 10);

// A pantry with one thing stocked (butter) and the rest not, so "already have"
// has something to hold and the walk has something to ask for.
const PANTRY = [
    { id: 1, user_id: UID, name: 'garlic', label: 'Garlic', category: 'Produce', in_stock: false, is_deleted: false, aliases: [] },
    { id: 2, user_id: UID, name: 'butter', label: 'Butter', category: 'Dairy', in_stock: true, is_deleted: false, aliases: [] },
    { id: 3, user_id: UID, name: 'chicken thighs', label: 'Chicken thighs', category: 'Protein', in_stock: false, is_deleted: false, aliases: [] },
    { id: 4, user_id: UID, name: 'sourdough', label: 'Sourdough', category: 'Bakery', in_stock: false, is_deleted: false, aliases: [] },
];

// She typed "garlic" by hand. The recipe below also wants garlic. One row.
const PROVISIONS = [
    { id: 101, user_id: UID, text: 'garlic', checked: false },
    { id: 102, user_id: UID, text: 'birthday candles', checked: false },
];

const RECIPES = [
    {
        id: 501, user_id: UID, title: 'Roast chicken', tags: [],
        ingredients: [
            { id: 9001, recipe_id: 501, item: 'garlic', amount: '4', unit: 'cloves' },
            { id: 9002, recipe_id: 501, item: 'butter', amount: '50', unit: 'g' },
            { id: 9003, recipe_id: 501, item: 'chicken thighs', amount: '6', unit: '' },
            { id: 9004, recipe_id: 501, item: 'sourdough', amount: '1', unit: 'loaf' },
        ],
    },
];

const MEAL_PLANS = [{ id: 701, user_id: UID, date: today, recipe_id: 501, meal: 'dinner' }];

const TABLES = {
    provisions: PROVISIONS,
    pantry_ingredients: PANTRY,
    recipes: RECIPES,
    meal_plans: MEAL_PLANS,
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });

await ctx.route('**', (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE)) return route.continue();

    const rest = url.match(/\/rest\/v1\/([a-z_]+)/);
    if (rest) {
        const body = TABLES[rest[1]];
        if (body) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'access-control-allow-origin': '*' },
                body: JSON.stringify(body),
            });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.abort();
});

await ctx.addInitScript(([ref, sess]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
}, [REF, session]);

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

let failures = 0;
const check = (name, ok, detail = '') => {
    if (ok) console.log(`  ok   ${name}`);
    else { failures++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); }
};

await page.goto(`${BASE}/larder`, { waitUntil: 'networkidle' });
await page.click('button:has-text("Provisions")');
await page.waitForSelector('.shop', { timeout: 5000 });

const shape = await page.evaluate(() => {
    const aisles = [...document.querySelectorAll('.shop__aisle')].map((el) => ({
        name: el.dataset.aisle,
        face: el.querySelector('.shop__face')?.textContent?.trim() || '',
        tally: el.querySelector('.shop__tally')?.textContent?.trim() || '',
        got: el.classList.contains('shop__aisle--got'),
        lines: [...el.querySelectorAll('.shop__row')].map((li) => ({
            what: li.querySelector('.shop__what')?.textContent?.trim(),
            amount: li.querySelector('.shop__amount')?.textContent?.trim() || '',
            stocked: !!li.querySelector('.shop__stocked'),
            for: li.querySelector('.shop__for')?.textContent?.trim() || '',
            ticked: li.querySelector('.shop__tick')?.getAttribute('aria-checked') === 'true',
        })),
    }));
    return {
        aisles,
        count: document.querySelector('.shop__count')?.textContent?.trim() || '',
        legacy: document.querySelectorAll('[class*="grocery-"]').length,
    };
});

console.log(JSON.stringify(shape, null, 2));

const all = shape.aisles.flatMap((a) => a.lines);
const named = (frag) => all.filter((l) => (l.what || '').toLowerCase().includes(frag));

check('the page rendered as a shop', shape.aisles.length > 0);
check('no page errors', errors.length === 0, errors.join(' | '));
check('no legacy grocery- markup left', shape.legacy === 0, `${shape.legacy} nodes`);

// One row for garlic, not two: she typed it and a recipe wants it.
const garlic = named('garlic');
check('garlic appears exactly once', garlic.length === 1, `${garlic.length} rows`);
check('garlic carries the recipe amount', garlic[0]?.amount === '4 cloves', garlic[0]?.amount);
check('garlic says what it is for', /Roast chicken/.test(garlic[0]?.for || ''), garlic[0]?.for);

// Butter is in the cupboard: out of the walk, into "already have", marked.
const walk = shape.aisles.filter((a) => !a.got);
const have = shape.aisles.find((a) => a.got);
check('there is an "Already have" section', have?.name === 'Already have', have?.name);
check('butter is in it', (have?.lines || []).some((l) => /Butter/i.test(l.what)), JSON.stringify(have?.lines));
check('butter is marked as in the pantry', (have?.lines || []).some((l) => l.stocked));
check('butter is not in the walk', !walk.flatMap((a) => a.lines).some((l) => /Butter/i.test(l.what)));

// Walk order, and the unmatched line last.
const order = walk.map((a) => a.name);
const WALK = ['Produce', 'Dairy', 'Protein', 'Bakery', 'Frozen', 'Pantry', 'Spices', 'Drinks', 'Anything else'];
const ranked = order.map((n) => WALK.indexOf(n));
check('aisles are in walk order', ranked.every((n, i) => i === 0 || n >= ranked[i - 1]), order.join(' → '));
check('the unmatched line lands in "Anything else"',
    (walk.find((a) => a.name === 'Anything else')?.lines || []).some((l) => /birthday candles/i.test(l.what)));

check('the count names what is left to get', /\d+ things? to get/.test(shape.count), shape.count);

// Emoji per aisle, and a count beside it, so a glance says where and how many.
check('every aisle wears a face', shape.aisles.every((a) => a.face.length > 0),
    shape.aisles.map((a) => `${a.name}:${a.face || '-'}`).join(' '));
check('every aisle counts its own lines',
    shape.aisles.every((a) => a.tally === String(a.lines.length)),
    shape.aisles.map((a) => `${a.name}:${a.tally}/${a.lines.length}`).join(' '));

// Every row is a control - the old planned rows drew a box you could not press.
const pressable = await page.$$eval('.shop__row .shop__tick', (els) => els.length);
check('every row has a tick control', pressable === all.length, `${pressable} of ${all.length}`);

await browser.close();
console.log(failures === 0 ? '\nAll provisions checks passed.' : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
