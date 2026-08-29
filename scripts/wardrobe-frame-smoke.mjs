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
 * Both are true in principle. Neither is worth betting a hand-built closet on
 * without watching a browser actually do it.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';

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

const server = http.createServer((req, res) => {
    const body = req.url.startsWith('/planner') ? PLANNER : HOST;
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

await browser.close();
server.close();

assert.ok(out.parseTime, 'the planner saw nothing at parse time — hydration was too late');
assert.equal(out.parseTime.me.length, 3, 'the planner read the account copy, not a default');
assert.deepEqual(out.heard, ['trips', 'closets'], 'every save was heard, in order');
assert.deepEqual(out.parentSees, [{ name: 'Napa' }], 'the iframe and the parent share one store');
assert.equal(out.parentUntouched, true, 'wrapping the iframe did not wrap the portal');

console.log('  ok  the planner reads the account copy at parse time');
console.log('  ok  every planner save is heard, and the portal\'s own storage is untouched');
console.log('\n2 passed');
