/**
 * The two assumptions the Wardrobe rescue rests on, checked in a real browser.
 *
 * 1. A same-origin iframe and its parent share one localStorage, so the portal
 *    can put the account's copy in place *before* the planner's script parses
 *    and reads it. The planner reads its state at parse time — `let trips =
 *    DB.load("trips",[])` on the first pass — so a hydration that lands one
 *    tick late lands too late.
 *
 * 2. The parent can wrap the iframe's own `setItem` and be told about every
 *    save, without touching the eighty kilobytes of planner or polling on a
 *    timer.
 *
 * 3. The parent can reach into the real planner and call its own `openTrip`,
 *    so `/wardrobe?trip=atlas-11` lands on that trip rather than on a list.
 *    That one is a call into eighty kilobytes of someone else's script, which
 *    is exactly the sort of thing that keeps working until it does not.
 *
 * All three are true in principle. None is worth betting a hand-built closet
 * on without watching a browser actually do it.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PLANNER = `<!doctype html><meta charset="utf-8"><body><script>
  // Stands in for the real planner: reads at parse time, writes on demand.
  var DB = {
    load: function (k, d) { try { var v = JSON.parse(localStorage.getItem("op_" + k)); return v == null ? d : v; } catch (e) { return d; } },
    save: function (k, v) { localStorage.setItem("op_" + k, JSON.stringify(v)); }
  };
  window.sawAtParseTime = DB.load("closets", null);
  window.planterSave = function (k, v) { DB.save(k, v); };
</script></body>`;

const HOST = `<!doctype html><meta charset="utf-8"><body><div id="slot"></div></body>`;

// The genuine article, for assumption 3. A stand-in cannot prove `openTrip`
// still exists in the file that actually ships.
const REAL = readFileSync(
    fileURLToPath(new URL('../public/outfit-planner.html', import.meta.url)), 'utf8'
);

const server = http.createServer((req, res) => {
    let body = HOST;
    if (req.url.startsWith('/planner')) body = PLANNER;
    if (req.url.startsWith('/outfit-planner.html')) body = REAL;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const tab = await browser.newPage();
await tab.goto(`${base}/`);

const out = await tab.evaluate(async (origin) => {
    // The portal's half: put the account's copy in place first...
    localStorage.setItem('op_closets', JSON.stringify({ me: [{ id: 1 }, { id: 2 }, { id: 3 }] }));

    // ...and only then let the planner start.
    const frame = document.createElement('iframe');
    frame.src = `${origin}/planner`;
    document.getElementById('slot').appendChild(frame);
    await new Promise((ok) => { frame.onload = ok; });

    const win = frame.contentWindow;
    const parseTime = win.sawAtParseTime;

    // Wrap the planner's own setItem and listen.
    const heard = [];
    const store = win.localStorage;
    const write = store.setItem.bind(store);
    store.setItem = (k, v) => { write(k, v); if (String(k).startsWith('op_')) heard.push(k.slice(3)); };

    win.planterSave('trips', [{ name: 'Napa' }]);
    win.planterSave('closets', { me: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });

    return {
        parseTime,
        heard,
        // The write really landed in the shared store, not just in the wrapper.
        parentSees: JSON.parse(localStorage.getItem('op_trips')),
        // And the parent's own setItem was not wrapped along with it.
        parentUntouched: localStorage.setItem === Storage.prototype.setItem,
    };
}, base);

/* --- 3. landing on a trip ------------------------------------------------ */

const deep = await tab.evaluate(async (origin) => {
    localStorage.clear();
    localStorage.setItem('op_trips', JSON.stringify([
        { id: 'atlas-11', name: 'Goa', dest: 'Goa', start: '2026-12-25', end: '2026-12-27',
          events: [{ date: '2026-12-25', type: 0 }], weather: {}, byProfile: {}, fromAtlas: true },
        { id: 'made-here', name: 'Something else', start: '2027-03-01', end: '2027-03-02',
          events: [], weather: {}, byProfile: {} },
    ]));

    const frame = document.createElement('iframe');
    frame.src = `${origin}/outfit-planner.html`;
    document.getElementById('slot').appendChild(frame);
    await new Promise((ok) => { frame.onload = ok; });

    const win = frame.contentWindow;
    const kind = typeof win.openTrip;
    if (kind !== 'function') return { kind };

    win.openTrip('atlas-11');
    const detail = win.document.getElementById('tripDetailView');
    const list = win.document.getElementById('tripListView');
    return {
        kind,
        // Not `win.currentTripId`: the planner declares it with `let` at the
        // top level of a classic script, and `let` does not become a property
        // of the window. What it actually rendered is the better witness
        // anyway — the id is bookkeeping, the page is the promise.
        detailShown: detail ? !detail.classList.contains('hide') : null,
        listHidden: list ? list.classList.contains('hide') : null,
        showing: (detail?.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
    };
}, base);

await browser.close();
server.close();

assert.ok(out.parseTime, 'the planner saw nothing at parse time — hydration was too late');
assert.equal(out.parseTime.me.length, 3, 'the planner read the account copy, not a default');
assert.deepEqual(out.heard, ['trips', 'closets'], 'every save was heard, in order');
assert.deepEqual(out.parentSees, [{ name: 'Napa' }], 'the iframe and the parent share one store');
assert.equal(out.parentUntouched, true, 'wrapping the iframe did not wrap the portal');

assert.equal(deep.kind, 'function', 'the real planner no longer exposes openTrip');
assert.equal(deep.detailShown, true, 'the trip opened but its detail view stayed hidden');
assert.equal(deep.listHidden, true, 'the list is still showing over the trip');
assert.ok(deep.showing.includes('Goa'), `landed on the wrong trip: ${deep.showing}`);
assert.ok(!deep.showing.includes('Something else'), 'the other trip came along too');

console.log('  ok  the planner reads the account copy at parse time');
console.log('  ok  every planner save is heard, and the portal\'s own storage is untouched');
console.log('  ok  the real planner opens the trip the deep link asked for');
console.log('\n3 passed');
