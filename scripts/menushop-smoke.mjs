// Smoke test for a menu's shopping list: the basket button on a menu card
// opens it, dishes can be made twice over, an ingredient can be swapped for
// this menu only, something no recipe asks for can be added, a second menu
// can be shopped for in the same trip, and the printed sheet is just the list.
//
// Supabase is answered from fixtures, and saves (PATCH) are accepted and
// ignored, so the page runs on its optimistic state. Run with:
//   npm run build && npm run preview, then
//   CHROME_PATH=... node scripts/menushop-smoke.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const REF = 'example';
const UID = '00000000-0000-4000-8000-000000000001';
const OUT = process.env.SHOTS || '';

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

const PANTRY = [
    { id: 1, user_id: UID, name: 'garlic', label: 'Garlic', category: 'Produce', in_stock: false, is_deleted: false, aliases: [] },
    { id: 2, user_id: UID, name: 'heavy cream', label: 'Heavy cream', category: 'Dairy', in_stock: true, is_deleted: false, aliases: [] },
    { id: 3, user_id: UID, name: 'beef stock', label: 'Beef stock', category: 'Pantry', in_stock: false, is_deleted: false, aliases: [] },
];

const RECIPES = [
    { id: 501, user_id: UID, title: 'Chicken au poivre', servings: '4-6', tags: [], ingredients: [
        { id: 9001, recipe_id: 501, item: 'garlic cloves', amount: '5', unit: '' },
        { id: 9002, recipe_id: 501, item: 'heavy cream', amount: '2', unit: 'cups' },
    ] },
    { id: 502, user_id: UID, title: 'French onion dauphinoise', servings: '8', tags: [], ingredients: [
        { id: 9003, recipe_id: 502, item: 'garlic', amount: '4', unit: '' },
        { id: 9004, recipe_id: 502, item: 'beef stock', amount: '250', unit: 'ml' },
    ] },
    { id: 503, user_id: UID, title: 'Princess cake', servings: '12', tags: [], ingredients: [
        { id: 9005, recipe_id: 503, item: 'heavy cream', amount: '2', unit: 'cups' },
    ] },
];

const MENUS = [
    { id: 'm1', user_id: UID, title: 'Thanksgiving 2026', occasion: '', notes: '', created_at: new Date().toISOString(), shop: null,
        user_larder_menu_recipes: [
            { id: 1, recipe_id: 501, course_name: 'Main Course', recipes: { id: 501, title: 'Chicken au poivre' } },
            { id: 2, recipe_id: 502, course_name: 'Side', recipes: { id: 502, title: 'French onion dauphinoise' } },
            { id: 3, recipe_id: null, item_name: 'Red Wine', item_note: '2-3 bottles', course_name: 'Drinks' },
        ] },
    { id: 'm2', user_id: UID, title: "Mom's birthday", occasion: '', notes: '', created_at: new Date().toISOString(), shop: null,
        user_larder_menu_recipes: [
            { id: 4, recipe_id: 503, course_name: 'Dessert', recipes: { id: 503, title: 'Princess cake' } },
        ] },
];

const TABLES = { pantry_ingredients: PANTRY, recipes: RECIPES, user_larder_menus: MENUS };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.route('**', (route) => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith(BASE)) return route.continue();
    const rest = url.match(/\/rest\/v1\/([a-z_]+)/);
    if (rest) {
        const body = req.method() === 'GET' ? (TABLES[rest[1]] || []) : [];
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
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

const rows = () => page.$$eval('.mshop .shop__aisle:not(.shop__aisle--got) .shop__row', (els) => els.map((li) => ({
    what: li.querySelector('.shop__what')?.textContent?.trim() || '',
    amount: li.querySelector('.shop__amount')?.textContent?.trim() || '',
    for: li.querySelector('.shop__for')?.textContent?.trim() || '',
    swapped: li.querySelector('.mshop__swapped')?.textContent?.trim() || '',
})));
const row = async (frag) => (await rows()).find((r) => r.what.toLowerCase().includes(frag));

await page.goto(`${BASE}/larder`, { waitUntil: 'networkidle' });
await page.click('[role="tab"]:has-text("Menus")');
await page.click('button[aria-label="Shopping list for Thanksgiving 2026"]');
await page.waitForSelector('.mshop', { timeout: 5000 });

let garlic = await row('garlic');
check('the menu list adds garlic from both dishes', garlic?.amount.startsWith('9'), JSON.stringify(garlic));
check('the bought wine is on the list with its note', (await row('red wine'))?.amount === '2-3 bottles');
check('cream in the pantry is out of the walk', !(await row('cream')));

// One step is half a batch more; two steps is twice the recipe.
await page.click('button[aria-label="Make more of Chicken au poivre"]');
await page.click('button[aria-label="Make more of Chicken au poivre"]');
garlic = await row('garlic');
check('making the chicken twice doubles its garlic only', garlic?.amount.startsWith('14'), JSON.stringify(garlic));
check('the line says the dish is doubled', /Chicken au poivre ×2/.test(garlic?.for || ''), garlic?.for);

await page.click('button[aria-label="Swap Beef stock for something else"]');
await page.fill('input[aria-label="Use instead of Beef stock"]', 'homemade chicken stock');
await page.click('.mshop__swap button[type="submit"]');
const stock = await row('chicken stock');
check('the swap replaces the stock and keeps the amount', stock?.amount === '250 ml', JSON.stringify(stock));
check('the swapped line says what it replaced', /beef stock/i.test(stock?.swapped || ''), stock?.swapped);
check('the change is listed with an undo', await page.locator('.mshop__changes li').count() === 1);

await page.fill('input[aria-label="Add something to buy for this menu"]', '4 disposable roasting pans');
await page.press('input[aria-label="Add something to buy for this menu"]', 'Enter');
check('an extra lands on the list', !!(await row('roasting pans')));

await page.uncheck('.mshop__check input');
check('turning the pantry off brings the cream back', (await row('cream'))?.amount === '4 cups', JSON.stringify(await row('cream')));

await page.click('.mshop__chip:has-text("Mom\'s birthday")');
const cream = await row('cream');
check('shopping for the birthday too adds the cake to the same cream line', cream?.amount === '6 cups', JSON.stringify(cream));
check('the title names both menus', /Thanksgiving 2026 \+ Mom's birthday/.test(await page.textContent('#mshop-title')));

if (OUT) await page.screenshot({ path: `${OUT}/menushop-screen.png`, fullPage: true });
await page.emulateMedia({ media: 'print' });
const printed = await page.evaluate(() => ({
    app: getComputedStyle(document.getElementById('root')).display,
    sheet: getComputedStyle(document.querySelector('.mshop-print')).display,
    rows: document.querySelectorAll('.mshop-print li').length,
}));
check('only the list prints, not the page behind it', printed.app === 'none' && printed.sheet === 'block', JSON.stringify(printed));
check('every line still to buy is on the printed sheet', printed.rows === (await rows()).length, `${printed.rows} rows`);
if (OUT) await page.pdf({ path: `${OUT}/menushop-print.pdf`, format: 'Letter', printBackground: true });

check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(failures === 0 ? '\nAll menu shopping checks passed.' : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
