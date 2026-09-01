import assert from 'node:assert/strict';
import { moveStart, setLength, lengthOfRow, setCost, fromDrag, headingFor } from '../src/utils/stopEdit.js';

let n = 0;
const t = (what, fn) => { fn(); n += 1; console.log(`  ok  ${what}`); };

t('moving a stop takes its length with it', () => {
    // Leaving the end where it was would stretch the block, not move it.
    const p = moveStart({ start_time: '09:00:00', end_time: '10:30:00' }, '14:00:00');
    assert.equal(p.start_time, '14:00:00');
    assert.equal(p.end_time, '15:30:00');
});

t('a stop with no end simply starts later', () => {
    const p = moveStart({ start_time: '09:00:00', end_time: null }, '14:00:00');
    assert.equal(p.start_time, '14:00:00');
    assert.equal(p.end_time, null);
});

t('clearing the time clears it', () => {
    assert.deepEqual(moveStart({ start_time: '09:00:00', end_time: '10:00:00' }, ''), { start_time: null });
});

t('a move over midnight keeps its length', () => {
    const p = moveStart({ start_time: '09:00:00', end_time: '11:00:00' }, '23:00:00');
    assert.equal(p.end_time, '01:00:00');
});

t('a length is stored as an end', () => {
    assert.deepEqual(setLength({ start_time: '09:00:00' }, '1:30'), { end_time: '10:30:00' });
    assert.deepEqual(setLength({ start_time: '09:00:00' }, null), { end_time: null });
});

t('and read back the same', () => {
    assert.equal(lengthOfRow({ start_time: '09:00:00', end_time: '10:30:00' }), '1:30');
    assert.equal(lengthOfRow({ start_time: '09:00:00' }), null);
});

t('a price is a number or nothing', () => {
    assert.deepEqual(setCost('30'), { cost: 30 });
    assert.deepEqual(setCost(''), { cost: null });
    assert.deepEqual(setCost('0'), { cost: 0 }, 'free is a price');
});

t('a block dragged out knows when it starts and how long it runs', () => {
    assert.deepEqual(fromDrag(9, 9), { start_time: '09:00:00', end_time: '10:00:00' });
    assert.deepEqual(fromDrag(9, 11), { start_time: '09:00:00', end_time: '12:00:00' });
});

t('dragged upwards is the same block as dragged downwards', () => {
    assert.deepEqual(fromDrag(11, 9), fromDrag(9, 11));
});

t('a nameless new stop is not called a failure', () => {
    assert.equal(headingFor({ title: '  ' }), 'A new stop');
    assert.equal(headingFor({ title: 'Lunch' }), 'Lunch');
});

console.log(`\n${n} passed`);
