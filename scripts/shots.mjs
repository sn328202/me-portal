/**
 * Screenshot harness. Boots the built app, fakes a session, mocks the Supabase
 * REST layer with realistic rows, and captures each page in each theme.
 *
 *   node scripts/shots.mjs [--out DIR] [--themes a,b] [--pages /,/larder]
 *
 * Not part of the app bundle.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : fallback;
};

const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = arg('out', '/tmp/shots');
const THEMES = arg('themes', 'dark-academia').split(',');
const PAGES = arg('pages', '/,/larder,/treasury,/atlas,/daydream,/library,/study,/play,/learning,/settings').split(',');
const WIDTH = Number(arg('width', 1440));
const HEIGHT = Number(arg('height', 900));

mkdirSync(OUT, { recursive: true });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const USER = '00000000-0000-4000-8000-000000000001';
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER, email: 'neha@example.com', role: 'authenticated', exp })}.sig`;
const session = {
    access_token: jwt,
    refresh_token: 'fake',
    expires_at: exp,
    expires_in: 86400,
    token_type: 'bearer',
    user: {
        id: USER, email: 'neha@example.com', aud: 'authenticated', role: 'authenticated',
        app_metadata: {}, user_metadata: {}, created_at: new Date(0).toISOString(),
    },
};

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// Rows shaped like the real schema, enough of them to expose layout problems
// that an empty page hides.
const DATA = {
    habits: [
        { id: 'h1', user_id: USER, text: 'drink water', completed: true, last_completed: new Date().toDateString(), streak: 4 },
        { id: 'h2', user_id: USER, text: 'morning workout', completed: false, last_completed: null },
        { id: 'h3', user_id: USER, text: 'read 1 hour a day', completed: true, last_completed: new Date().toDateString() },
        { id: 'h4', user_id: USER, text: 'work on mojie', completed: false, last_completed: null },
        { id: 'h5', user_id: USER, text: 'read marathi / hindi books', completed: false, last_completed: null },
    ],
    todos: [
        { id: 't1', user_id: USER, text: 'create listable using claude', completed: false, created_at: new Date().toISOString() },
        { id: 't2', user_id: USER, text: 'set up claude entirely', completed: false, created_at: new Date().toISOString() },
        { id: 't3', user_id: USER, text: 'book the ferry tickets for the fjord trip', completed: true, created_at: new Date().toISOString() },
    ],
    chores: [
        { id: 'c1', user_id: USER, text: 'water the plants', room: 'Kitchen', completed: false, frequency: 'weekly' },
        { id: 'c2', user_id: USER, text: 'change the bed linen', room: 'Bedroom', completed: true, frequency: 'weekly' },
        { id: 'c3', user_id: USER, text: 'descale the kettle', room: 'Kitchen', completed: false, frequency: 'monthly' },
    ],
    goals: [
        { id: 'g1', user_id: USER, text: 'Run a half marathon', horizon: 'year', progress: 40, completed: false },
        { id: 'g2', user_id: USER, text: 'Finish the Marathi reader', horizon: 'month', progress: 65, completed: false },
    ],
    hobbies: [
        { id: 'hb1', user_id: USER, name: 'Stained glass', last_session: new Date().toISOString(), total_sessions: 12 },
        { id: 'hb2', user_id: USER, name: 'Film photography', last_session: new Date(Date.now() - 3 * 864e5).toISOString(), total_sessions: 30 },
    ],
    social_plans: [
        { id: 's1', user_id: USER, title: 'Dinner with Zeyi + Qing', when_date: day(3), status: 'confirmed', location: 'Mission' },
        { id: 's2', user_id: USER, title: 'Malvika + Nitin memorial day', when_date: day(14), status: 'pending', location: null },
    ],
    provisions: [
        { id: 'p1', user_id: USER, text: 'sesame oil', checked: false },
        { id: 'p2', user_id: USER, text: 'gochujang', checked: true },
        { id: 'p3', user_id: USER, text: 'unsalted butter', checked: false },
    ],
    workouts: [
        { id: 'w1', user_id: USER, day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }), title: 'Push + core', details: ['Bench 4x8', 'Overhead press 3x10', 'Plank 3x60s'] },
    ],
    library_items: [
        { id: 'l1', user_id: USER, title: 'Piranesi', creator: 'Susanna Clarke', type: 'books', rating: 5, status: 'finished', created_at: new Date().toISOString(), image_url: null },
        { id: 'l2', user_id: USER, title: 'Perfect Days', creator: 'Wim Wenders', type: 'movies', rating: 5, status: 'finished', created_at: new Date(Date.now() - 864e5).toISOString(), image_url: null },
        { id: 'l3', user_id: USER, title: 'The Bear', creator: 'FX', type: 'tv shows', rating: 4, status: 'watching', created_at: new Date(Date.now() - 2 * 864e5).toISOString(), image_url: null },
    ],
    treasury_items: [
        { id: 'ti1', user_id: USER, title: 'Indian Garden Wallpaper, Green', category: 'Home', price: '500', priority: 'Low', status: 'desired', url: 'https://example.com', image_url: null, notes: '' },
        { id: 'ti2', user_id: USER, title: 'Chopping Block + Knife, Notorious Foodie', category: 'Kitchen', price: '275', priority: 'Medium', status: 'desired', url: 'https://example.com', image_url: null, notes: '' },
        { id: 'ti3', user_id: USER, title: 'Lemon Squeezer, Fish', category: 'Kitchen', price: '38', priority: 'Low', status: 'acquired', url: 'https://example.com', image_url: null, notes: '' },
        { id: 'ti4', user_id: USER, title: 'Stamp Choker by Taylor Heller | Camóre', category: 'Closet', price: '370', priority: 'Low', status: 'desired', url: 'https://example.com', image_url: null, notes: '' },
    ],
    treasury_brands: [
        { id: 'tb1', user_id: USER, name: 'Camóre', url: 'https://example.com', notes: 'Good for quality linens and small silver.' },
    ],
    atlas_trips: [
        { id: 'a1', user_id: USER, destination: 'Fjord Norway', status: 'Dreaming', start_date: day(60), notes: '', cover_image_url: null, budget: 3200 },
        { id: 'a2', user_id: USER, destination: 'Napa Valley, CA', status: 'Planned', start_date: day(21), notes: '', cover_image_url: null, budget: 800 },
    ],
    atlas_waypoints: [{ id: 'wp1', user_id: USER, trip_id: 'a1', name: 'Bergen', lat: 60.39, lng: 5.32 }],
    recipes: [
        { id: 'r1', user_id: USER, title: 'Three-Cup Chicken', source: 'Imported', instructions: 'Braise.', created_at: new Date().toISOString(), ingredients: [{ id: 'i1', item: 'sesame oil', amount: '3', unit: 'tablespoons' }, { id: 'i2', item: 'ginger', amount: '12', unit: 'pcs' }, { id: 'i3', item: 'garlic', amount: '12', unit: 'cloves' }] },
        { id: 'r2', user_id: USER, title: 'Charred Cabbage With Miso Browned Butter', source: 'Imported', instructions: 'Char.', created_at: new Date().toISOString(), ingredients: [{ id: 'i4', item: 'cabbage', amount: '1', unit: 'pcs' }, { id: 'i5', item: 'olive oil', amount: '1/4', unit: 'cup' }] },
        { id: 'r3', user_id: USER, title: 'Skillet Gnocchi With Miso Butter and Asparagus', source: 'Imported', instructions: 'Fry.', created_at: new Date().toISOString(), ingredients: [{ id: 'i6', item: 'gnocchi', amount: '1', unit: 'packet' }] },
    ],
    pantry_ingredients: [
        { id: 'pi1', user_id: USER, name: 'sesame oil', category: 'Pantry', in_stock: true, emoji: '🫗' },
        { id: 'pi2', user_id: USER, name: 'garlic', category: 'Produce', in_stock: true, emoji: '🧄' },
        { id: 'pi3', user_id: USER, name: 'cabbage', category: 'Produce', in_stock: false, emoji: '🥬' },
    ],
    meal_plans: [{ id: 'mp1', user_id: USER, day_of_week: 'Monday', recipe_id: 'r1' }],
    day_plans: [
        { id: 'dp1', user_id: USER, title: 'Zeyi + Qing Day Trip!', location: 'Napa Valley, CA', plan_date: day(5) },
        { id: 'dp2', user_id: USER, title: 'Stained Glass Workshop', location: 'San Francisco, CA', plan_date: null },
        { id: 'dp3', user_id: USER, title: 'Curious Scents Day', location: 'Berkeley, California', plan_date: null },
    ],
    plan_items: [
        { id: 'pit1', plan_id: 'dp1', title: 'Drive up', start_time: '09:00:00', duration: '01:30', position: 0, category: 'travel' },
        { id: 'pit2', plan_id: 'dp1', title: 'Tasting at Ashes & Diamonds', start_time: '11:00:00', duration: '02:00', position: 1, category: 'food' },
    ],
    projects: [{ id: 'pr1', name: 'me.portal', color: 'var(--accent-gold)' }],
    project_tasks: [
        { id: 'pt1', project_id: 'pr1', title: 'Rebuild the design system', status: 'doing', position: 0 },
        { id: 'pt2', project_id: 'pr1', title: 'Capture the schema', status: 'todo', position: 0 },
    ],
    user_larder_menus: [],
    user_larder_menu_recipes: [],
    user_news_config: [],
    recipe_tags: [{ id: 'tg1', user_id: USER, recipe_id: 'r1', tag: 'weeknight' }],
    ingredients: [],
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });

    await ctx.route('**', async (route) => {
        const url = route.request().url();
        if (url.startsWith(BASE)) return route.continue();

        // Supabase REST: /rest/v1/<table>?...
        const m = url.match(/\/rest\/v1\/([a-z_]+)/);
        if (m) {
            const rows = DATA[m[1]] || [];
            const single = route.request().headers()['accept']?.includes('vnd.pgrst.object');
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'access-control-allow-origin': '*' },
                body: JSON.stringify(single ? rows[0] || null : rows),
            });
        }
        if (url.includes('/auth/v1/')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
        }
        return route.abort();
    });

    await ctx.addInitScript(
        ([s, t]) => {
            localStorage.setItem('sb-example-auth-token', JSON.stringify(s));
            localStorage.setItem('me_portal_vibe', t);
            localStorage.setItem(`welcome_dismissed_${'00000000-0000-4000-8000-000000000001'}`, 'true');
        },
        [session, theme]
    );

    for (const path of PAGES) {
        const page = await ctx.newPage();
        page.on('pageerror', (e) => console.log(`  ! ${path} pageerror:`, e.message.slice(0, 200)));
        try {
            await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 25000 });
            await page.waitForTimeout(1200);
            const boundary = await page.locator('[role="alert"]').count();
            if (boundary) {
                await page.locator('[role="alert"] summary').first().click().catch(() => {});
                await page.waitForTimeout(150);
                console.log(`  ! ${path} error boundary:`,
                    (await page.locator('[role="alert"]').first().innerText()).replace(/\s+/g, ' ').slice(0, 300));
            }
            const name = `${theme}${path === '/' ? '-dashboard' : path.replace(/\//g, '-')}`;
            await page.screenshot({ path: `${OUT}/${name}.png` });
            console.log('shot', name);
        } catch (e) {
            console.log('FAIL', theme, path, e.message.split('\n')[0]);
        }
        await page.close();
    }
    await ctx.close();
}

await browser.close();
