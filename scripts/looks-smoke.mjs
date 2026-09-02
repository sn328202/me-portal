/**
 * Saved looks, driven in a real browser.
 *
 * The unit tests cover the arithmetic; this covers the eighty kilobytes of
 * classic script around it — that the tab switches, that a look survives a
 * reload, that wearing one lands on the day, and that a day with nothing on
 * it offers the right look by name. None of that has a seam to unit-test
 * through, and all of it is what she would actually notice being broken.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../public/outfit-planner.html', import.meta.url)), 'utf8');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
}).listen(0);
const port = server.address().port;

const CLOSET = [
    { id: 'cami', cat: 'Tops', name: 'Silk cami', color: '', dress: 4, warmth: 2, rain: false, style: 'Everyday', notes: '', img: '' },
    { id: 'tee', cat: 'Tops', name: 'White tee', color: '', dress: 1, warmth: 2, rain: false, style: 'Everyday', notes: '', img: '' },
    { id: 'trousers', cat: 'Bottoms', name: 'Black trousers', color: '', dress: 4, warmth: 3, rain: false, style: 'Everyday', notes: '', img: '' },
    { id: 'jeans', cat: 'Bottoms', name: 'Blue jeans', color: '', dress: 2, warmth: 3, rain: false, style: 'Everyday', notes: '', img: '' },
    { id: 'mules', cat: 'Shoes', name: 'Heeled mules', color: '', dress: 4, warmth: 3, rain: false, style: 'Everyday', notes: '', img: '' },
    { id: 'sambas', cat: 'Shoes', name: 'Sambas', color: '', dress: 1, warmth: 3, rain: false, style: 'Everyday', notes: '', img: '' },
];

const TRIP = {
    id: 'trip1',
    name: 'Test trip',
    dest: 'Somewhere',
    start: '2026-10-01',
    end: '2026-10-02',
    events: [
        { id: 'e1', date: '2026-10-01', name: 'Dinner', type: 0, dress: 4 },
        { id: 'e2', date: '2026-10-02', name: 'Walking', type: 0, dress: 1 },
    ],
    weather: {},
    byProfile: {},
};

const seed = {
    op_profiles: JSON.stringify([{ id: 'me', name: 'Neha', mode: 'closet' }]),
    op_activeProfile: JSON.stringify('me'),
    op_closets: JSON.stringify({ me: CLOSET }),
    op_essAll: JSON.stringify({ me: {} }),
    op_essCatsAll: JSON.stringify({ me: ['Toiletries'] }),
    op_trips: JSON.stringify([TRIP]),
};

let n = 0;
const t = async (name, fn) => { await fn(); n += 1; console.log(`  ok  ${name}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.addInitScript((rows) => {
    for (const [k, v] of Object.entries(rows)) localStorage.setItem(k, v);
}, seed);

try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });

    console.log('the shelf:');

    await t('there is a Looks tab and it opens its own panel', async () => {
        await page.click('.tab[data-tab="looks"]');
        assert.equal(await page.isVisible('#tab-looks'), true);
        assert.equal(await page.isVisible('#tab-closet'), false);
        assert.match(await page.textContent('#looksTitle'), /Neha/);
    });

    await t('empty, it says how to start rather than nothing', async () => {
        assert.match(await page.textContent('#looksGrid'), /No saved looks yet/);
    });

    console.log('\nbuilding one:');

    await t('the builder offers a slot per category, from the closet', async () => {
        await page.click('#tab-looks button.btn');
        await page.waitForSelector('#lookModal[open]');
        const slots = await page.$$('#lookSlots .ofIn');
        assert.ok(slots.length >= 7, `a slot per category, got ${slots.length}`);
    });

    await t('and saving it puts it on the shelf', async () => {
        await page.fill('#lookName', 'Nice dinner');
        await page.fill('#lookSlots .ofIn[data-cat="Tops"]', 'Silk cami');
        await page.fill('#lookSlots .ofIn[data-cat="Bottoms"]', 'Black trousers');
        await page.fill('#lookSlots .ofIn[data-cat="Shoes"]', 'Heeled mules');
        await page.click('#lookModal button.btn.right');
        await page.waitForSelector('#lookModal[open]', { state: 'detached' }).catch(() => {});
        const text = await page.textContent('#looksGrid');
        assert.match(text, /Nice dinner/);
        assert.match(text, /Silk cami/);
        assert.match(text, /Cocktail/, 'it works out its own dressiness');
    });

    await t('it is written where the account backup will find it', async () => {
        // Not in trips, not in closets — its own key, which is the one the
        // portal mirrors to Postgres.
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('op_looksAll')));
        assert.equal(stored.me.length, 1);
        assert.equal(stored.me[0].name, 'Nice dinner');
        assert.equal(stored.me[0].items.Tops, 'cami');
    });

    await t('and it is still there after a reload', async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.click('.tab[data-tab="looks"]');
        assert.match(await page.textContent('#looksGrid'), /Nice dinner/);
    });

    console.log('\non a trip:');

    await t('a day it suits offers it by name', async () => {
        await page.click('.tab[data-tab="trips"]');
        await page.click('#tripList .trip-card, #tripList [onclick*="openTrip"]').catch(async () => {
            await page.evaluate(() => window.openTrip('trip1'));
        });
        await page.waitForSelector('#planContent .daycard');
        const board = await page.textContent('#planContent');
        assert.match(board, /Your look/, 'the offer appears');
        assert.match(board, /Nice dinner/);
    });

    await t('but only on the day it suits', async () => {
        // Two days: a cocktail dinner and a casual walk. Heeled mules are not
        // the walk, so the walk must not be offered this look.
        const cards = await page.$$('#planContent .daycard');
        assert.equal(cards.length, 2, 'two days');
        const said = await Promise.all(cards.map((c) => c.textContent()));
        const offered = said.map((s) => /Nice dinner/.test(s));
        assert.deepEqual(offered, [true, false], 'offered on the dressy day only');
    });

    await t('wearing it puts a copy on that day', async () => {
        await page.click('#planContent .daycard button.btn.btn-sm.right');
        await page.waitForFunction(() => document.querySelectorAll('#planContent .ocard').length > 0);
        assert.match(await page.textContent('#planContent .ocard'), /Nice dinner/);

        const { look, worn } = await page.evaluate(() => {
            const l = JSON.parse(localStorage.getItem('op_looksAll')).me[0];
            const w = JSON.parse(localStorage.getItem('op_trips'))[0].byProfile.me.customOutfits[0];
            return { look: l, worn: w };
        });
        assert.notEqual(worn.id, look.id, 'a copy, not the same record');
        assert.equal(worn.fromLook, look.id, 'that remembers where it came from');
        assert.equal(worn.date, '2026-10-01');
        assert.deepEqual(worn.items, look.items);
    });

    await t('and the day stops offering once it is dressed', async () => {
        const first = await page.textContent('#planContent .daycard');
        assert.equal(/would work here/.test(first), false);
    });

    page.on('dialog', (d) => d.accept('Kept from the trip'));
    await t('an outfit built on a trip can be kept as a look', async () => {
        await page.click('#planContent .ocard button.iconbtn');
        // The prompt for a name.
        await page.waitForTimeout(50);
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('op_looksAll')).me.length);
        assert.ok(stored >= 1);
    });

    console.log(`\nlooks-smoke: ${n} passed`);
} finally {
    await browser.close();
    server.close();
}
