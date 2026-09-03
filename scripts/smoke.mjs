// Ad-hoc smoke test: boots the built app, fakes a Supabase session so the
// protected routes render, and visits every route looking for crashes.
// Not part of the app bundle. Run with: npm run smoke (after npm run build + preview).
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const REF = 'example'; // matches VITE_SUPABASE_URL host in .env.local

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
const fakeJwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'smoke@test.local',
    role: 'authenticated',
    exp,
})}.sig`;

const session = {
    access_token: fakeJwt,
    refresh_token: 'fake-refresh',
    expires_at: exp,
    expires_in: 86400,
    token_type: 'bearer',
    user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'smoke@test.local',
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: new Date(0).toISOString(),
    },
};

const ROUTES = [
    '/', '/larder', '/treasury', '/library', '/atlas',
    // The Wardrobe is an iframe around the real 81KB planner, and the deep
    // link reaches into it and calls its own `openTrip`. Both are exactly the
    // kind of thing that works until the planner is edited by someone else.
    '/wardrobe', '/wardrobe?trip=atlas-4242',
    // Retired rooms. Kept in the list because a bookmark is a promise: these
    // must still land somewhere, and a redirect that has quietly stopped
    // redirecting looks exactly like a working page until you follow it.
    '/daydream', '/commonplace', '/tablebook',
    // Learning is the Study's Curator tab now and Systems is gone entirely.
    // Both still have to land somewhere: see the note above.
    '/study', '/learning', '/systems',
    '/play', '/settings', '/no-such-page',
];

const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

// Block all outbound network except our own origin, so the dummy Supabase host
// fails fast instead of hanging on DNS.
await ctx.route('**', (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE)) return route.continue();
    return route.abort();
});

await ctx.addInitScript(
    ([ref, sess]) => {
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
        // A trip in the planner's own storage, so `/wardrobe?trip=…` has
        // something real to land on rather than quietly doing nothing.
        localStorage.setItem('op_trips', JSON.stringify([{
            id: 'atlas-4242', name: 'Smoke Trip', dest: 'Goa',
            start: '2026-12-25', end: '2026-12-27',
            events: [{ date: '2026-12-25', type: 0, label: 'A day' }],
            weather: {}, byProfile: {}, fromAtlas: true,
        }]));
        localStorage.setItem('op_profiles', JSON.stringify([{ id: 'p1', name: 'Neha' }]));
    },
    [REF, session],
);

let failures = 0;
for (const path of ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
        if (m.type() === 'error') {
            const t = m.text();
            // Network failures against the dummy Supabase host are expected.
            if (/Failed to load resource|net::ERR_|Fetch|Failed to fetch|WebSocket|realtime|Google Maps|ERR_TUNNEL/i.test(t)) return;
            errors.push(`console: ${t.slice(0, 200)}`);
        }
    });

    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(700);

    const body = (await page.locator('body').innerText()).trim();
    const rootHtml = await page.locator('#root').innerHTML();
    // A component that gave up — not merely a page showing a notice.
    const boundaryHit = await page.locator('[data-error-boundary]').count();
    const blank = rootHtml.length < 200;

    const status = errors.length || blank || boundaryHit ? 'FAIL' : 'ok';
    if (status === 'FAIL') failures++;
    console.log(
        `${status.padEnd(4)} ${path.padEnd(16)} chars=${String(rootHtml.length).padStart(6)}` +
        ` boundary=${boundaryHit} :: ${body.replace(/\s+/g, ' ').slice(0, 90)}`,
    );
    for (const e of errors.slice(0, 4)) console.log(`       ${e}`);
    await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} route(s) failed` : '\nAll routes rendered clean');
process.exit(failures ? 1 : 0);
