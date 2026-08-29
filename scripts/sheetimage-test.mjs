import assert from 'node:assert/strict';
import { shotName, shotSize, shotScale } from '../src/utils/sheetImage.js';

let n = 0;
const t = (what, fn) => { fn(); n += 1; console.log(`  ok  ${what}`); };

t('a name is a slug', () => {
    assert.equal(shotName('Will in SF!', '2026-08-29'), 'will-in-sf-2026-08-29.png');
});

t('a name survives having nothing to work with', () => {
    assert.equal(shotName('', ''), 'day.png');
    assert.equal(shotName('!!!', null), 'day.png');
});

t('a half-typed date is not stapled on', () => {
    assert.equal(shotName('Napa', '2026-08'), 'napa.png');
    assert.equal(shotName('Napa', '0002-08-29'), 'napa-0002-08-29.png');
});

t('a long name is cut, not refused', () => {
    const name = shotName('a'.repeat(200), '');
    assert.equal(name, `${'a'.repeat(60)}.png`);
});

t('the size is the scrolled size, not the visible one', () => {
    assert.deepEqual(shotSize({ scrollWidth: 640, scrollHeight: 3200, offsetWidth: 640, offsetHeight: 400 }), { width: 640, height: 3200 });
});

t('no node is no size', () => {
    assert.deepEqual(shotSize(null), { width: 0, height: 0 });
});

t('short sheets are drawn at twice the size', () => {
    assert.equal(shotScale(1200), 2);
    assert.equal(shotScale(0), 2);
});

t('very long sheets are held under the ceiling', () => {
    assert.equal(shotScale(12000), 1);
    assert.equal(shotScale(8000), 12000 / 8000);
    assert.ok(shotScale(40000) >= 1);
});

console.log(`\n${n} passed`);
