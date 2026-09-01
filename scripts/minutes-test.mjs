import assert from 'node:assert/strict';
import { minutesOf } from '../src/utils/minutes.js';
import { todayLocal } from '../src/utils/today.js';

/*
 * `minutesOf` and `todayLocal` were carried out of `planToAtlas` and
 * `planShelf` when the Daydream was retired. Nothing about them changed, so
 * this file is the proof of that rather than a fresh specification: every case
 * below is one the old modules already passed.
 */

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

it('reads the picker\'s own format', () => {
    assert.equal(minutesOf('1:30'), 90);
    assert.equal(minutesOf('0:45'), 45);
    assert.equal(minutesOf('2:00'), 120);
    assert.equal(minutesOf('12:15'), 735);
});

it('reads the years of free text behind it', () => {
    assert.equal(minutesOf('2 hours'), 120);
    assert.equal(minutesOf('90 min'), 90);
    assert.equal(minutesOf('45 minutes'), 45);
    assert.equal(minutesOf('1 hr'), 60);
    assert.equal(minutesOf('1.5 hours'), 90);
});

it('guesses a bare number by its size, as it always has', () => {
    assert.equal(minutesOf('2'), 120, 'under 13 is hours');
    assert.equal(minutesOf('12'), 720, 'twelve is still hours');
    assert.equal(minutesOf('13'), 13, 'over twelve is minutes');
    assert.equal(minutesOf('90'), 90);
});

it('keeps its known quirk: a compound reads only the first number', () => {
    // "1 hour 5 mins" is 1, and the minutes unit wins, so it is one minute.
    // departAt.js has a stricter reader precisely because of this.
    assert.equal(minutesOf('1 hour 5 mins'), 1);
});

it('gives nothing rather than nonsense', () => {
    assert.equal(minutesOf(''), null);
    assert.equal(minutesOf(null), null);
    assert.equal(minutesOf(undefined), null);
    assert.equal(minutesOf('a couple of hours'), null);
    assert.equal(minutesOf('0'), null);
    assert.equal(minutesOf('-3 hours'), 180, 'the minus is not read; the number is');
});

it('today is the date on the wall, not the date in Greenwich', () => {
    // 8pm on the 30th in California is already the 31st in UTC.
    const evening = new Date(2026, 7, 30, 20, 0, 0);
    assert.equal(todayLocal(evening), '2026-08-30');
    assert.equal(todayLocal(new Date(2026, 0, 1, 0, 0, 0)), '2026-01-01');
    assert.equal(todayLocal(new Date(2026, 11, 31, 23, 59, 0)), '2026-12-31');
});

console.log(`minutes + today: ${n} passed`);
