import assert from 'node:assert/strict';
import { settled, asDate } from '../src/utils/dateField.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

it('refuses every step on the way to typing a year', () => {
    // What the browser actually reports, keystroke by keystroke, for 2026.
    assert.equal(settled('0002-09-12'), false);
    assert.equal(settled('0020-09-12'), false);
    assert.equal(settled('0202-09-12'), false);
    assert.equal(settled('2026-09-12'), true);
});

it('takes a date someone meant', () => {
    assert.equal(settled('1990-01-01'), true);
    assert.equal(settled('2026-12-31'), true);
    assert.equal(settled('2199-06-15'), true);
});

it('takes empty, because clearing a date is deliberate', () => {
    assert.equal(settled(''), true);
    assert.equal(settled(null), true);
    assert.equal(settled(undefined), true);
    assert.equal(settled('   '), true);
});

it('refuses years nobody is planning around', () => {
    assert.equal(settled('1899-01-01'), false);
    assert.equal(settled('2201-01-01'), false);
});

it('refuses days that are well-formed and not days', () => {
    assert.equal(settled('2026-02-31'), false);
    assert.equal(settled('2026-13-01'), false);
    assert.equal(settled('2026-00-10'), false);
    assert.equal(settled('2026-06-31'), false, 'June has thirty days');
    assert.equal(settled('2025-02-29'), false, '2025 is not a leap year');
    assert.equal(settled('2024-02-29'), true, '2024 is');
});

it('refuses anything that is not the shape at all', () => {
    assert.equal(settled('2026-9-12'), false);
    assert.equal(settled('12/09/2026'), false);
    assert.equal(settled('tomorrow'), false);
});

it('reads a stored value the way the input wants it', () => {
    assert.equal(asDate('2026-09-12T00:00:00.000Z'), '2026-09-12');
    assert.equal(asDate('2026-09-12'), '2026-09-12');
    assert.equal(asDate(null), '');
    assert.equal(asDate(undefined), '');
    assert.equal(asDate(''), '');
    assert.equal(asDate('nonsense'), '');
});

console.log(`dateField: ${n} passed`);
