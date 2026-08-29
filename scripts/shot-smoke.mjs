/**
 * The share sheet really does come out as a picture.
 *
 * Not a unit test of a pure function — the whole question is whether a real
 * browser can photograph a real styled node, with a web font and an emoji in
 * it, and hand back pixels that are not blank. So a real browser does it.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const lib = readFileSync('node_modules/modern-screenshot/dist/index.js', 'utf8');

const page = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono&display=swap');
  body { margin: 0; background: #101014; }
  .wrap { max-height: 120px; overflow-y: auto; background: #1b1b22; }
  .shot { padding: 16px; background: #1b1b22; }
  .card { background: #24242e; border: 2px solid #c8a24a; border-radius: 8px; padding: 20px; color: #ece7dd; }
  h1 { font-family: 'Archivo Black', sans-serif; color: #c8a24a; margin: 0 0 8px; }
  li { font-family: 'Space Mono', monospace; list-style: none; padding: 8px 0; border-top: 1px dashed #555; }
</style></head><body>
<div class="wrap"><div class="shot" id="shot">
  <div class="card">
    <h1>WILL IN SF</h1>
    <ul>
      <li>🥗 11:00 am — Lunette Lunch</li>
      <li>📍 12:30 pm — Treasure Island picnic</li>
      <li>🍸 4:30 pm — Saison Cellar</li>
      <li>🥐 8:30 am — Arsicault Breakfast</li>
    </ul>
  </div>
</div></div>
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const tab = await browser.newPage({ viewport: { width: 900, height: 700 } });
await tab.setContent(page, { waitUntil: 'load' });
await tab.evaluate(() => document.fonts.ready);
await tab.addScriptTag({ content: lib });

const out = await tab.evaluate(async () => {
    const node = document.getElementById('shot');
    const height = node.scrollHeight;
    const url = await window.modernScreenshot.domToDataUrl(node, {
        width: node.scrollWidth,
        height,
        scale: 2,
        backgroundColor: '#1b1b22',
        type: 'image/png',
    });


    // Read it back and look at it, because "a data URL came back" is not the
    // same claim as "there is a picture in it".
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const px = c.getContext('2d').getImageData(0, 0, img.width, img.height).data;

    const seen = new Set();
    for (let i = 0; i < px.length; i += 4 * 97) seen.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);

    return { bytes: url.length, w: img.width, h: img.height, cssHeight: height, colours: seen.size, url };
});

await browser.close();

if (process.env.SHOT_OUT && out.url) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.SHOT_OUT, Buffer.from(out.url.split(',')[1], 'base64'));
}

assert.ok(out.bytes > 5000, `the picture is suspiciously small (${out.bytes} bytes)`);
assert.equal(out.w, 900 * 2, 'drawn at twice the width');
assert.equal(out.h, out.cssHeight * 2, 'the whole scrolled height, not the 120px window');
assert.ok(out.cssHeight > 200, 'the node really was taller than its scroller');
assert.ok(out.colours > 8, `the picture is flat — only ${out.colours} colours, so nothing rendered`);

console.log(`  ok  a ${out.w}x${out.h} picture, ${out.colours} colours, ${Math.round(out.bytes / 1024)}kB`);
console.log('\n1 passed');
