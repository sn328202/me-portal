import assert from 'node:assert/strict';
import { splitDuration, joinDuration } from '../src/utils/duration.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

it('splits what is already stored, however it was written', () => {
    assert.deepEqual(splitDuration('2 hours'), { hours: 2, minutes: 0 });
    assert.deepEqual(splitDuration('90 min'), { hours: 1, minutes: 30 });
    assert.deepEqual(splitDuration('1:30'), { hours: 1, minutes: 30 });
    assert.deepEqual(splitDuration('45 mins'), { hours: 0, minutes: 45 });
    assert.deepEqual(splitDuration('2'), { hours: 2, minutes: 0 });
});

it('reads nothing as nothing', () => {
    assert.deepEqual(splitDuration(''), { hours: 0, minutes: 0 });
    assert.deepEqual(splitDuration(null), { hours: 0, minutes: 0 });
    assert.deepEqual(splitDuration('a couple of hours'), { hours: 0, minutes: 0 });
});

it('joins back into something nothing has to guess at', () => {
    assert.equal(joinDuration(1, 30), '1:30');
    assert.equal(joinDuration(0, 30), '0:30');
    assert.equal(joinDuration(2, 0), '2:00');
    assert.equal(joinDuration(2, 15), '2:15');
});

it('unset is null, not zero', () => {
    assert.equal(joinDuration(0, 0), null);
    assert.equal(joinDuration(null, null), null);
    assert.equal(joinDuration('', ''), null);
});

it('round-trips', () => {
    for (const [h, m] of [[0, 30], [1, 0], [2, 15], [12, 55]]) {
        assert.deepEqual(splitDuration(joinDuration(h, m)), { hours: h, minutes: m });
    }
});

it('refuses nonsense rather than storing it', () => {
    assert.equal(joinDuration(-3, -8), null);
    assert.equal(joinDuration(99, 99), '23:59');
    assert.equal(joinDuration(1.7, 30.2), '1:30');
});

console.log(`duration: ${n} passed`);
