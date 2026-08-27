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
import { DATA } from './_data.mjs';

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

// Fixtures live in _data.mjs. They used to be pasted here as well, so the two
// copies drifted and only one of them was ever the one being screenshotted.
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
