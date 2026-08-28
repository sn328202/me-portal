import assert from 'node:assert/strict';
import { driveMinutes, departAt, nextSlot } from '../src/utils/departAt.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

/* --- reading a drive time ------------------------------------------- */

it('reads what Google says', () => {
    assert.equal(driveMinutes('25 mins'), 25);
    assert.equal(driveMinutes('1 hour'), 60);
    assert.equal(driveMinutes('1 hour 5 mins'), 65);
    assert.equal(driveMinutes('2 hours 30 mins'), 150);
    assert.equal(driveMinutes('1 hr 45 min'), 105);
});

it('reads what she types', () => {
    assert.equal(driveMinutes('20'), 20, 'a bare number in a travel box is minutes');
    assert.equal(driveMinutes('1:15'), 75);
    assert.equal(driveMinutes('about 40 minutes on the ferry'), 40);
});

it('has nothing to say about nothing', () => {
    assert.equal(driveMinutes(''), null);
    assert.equal(driveMinutes(null), null);
    assert.equal(driveMinutes(undefined), null);
    assert.equal(driveMinutes('soon'), null);
    assert.equal(driveMinutes('0 mins'), null);
});

/* --- when to leave --------------------------------------------------- */

const lunch = { start_time: '12:00:00', duration: '2 hours' };
const table = { start_time: '19:00:00' };

it('subtracts the drive from the next start', () => {
    const d = departAt(lunch, table, '45 mins');
    assert.equal(d.time, '18:15:00');
    assert.equal(d.tight, false, 'lunch is long over by then');
});

it('says so when the current thing runs past the leave time', () => {
    const long = { start_time: '12:00:00', duration: '7 hours' };
    const d = departAt(long, table, '45 mins');
    assert.equal(d.time, '18:15:00');
    assert.equal(d.tight, true);
});

it('stays quiet when it cannot know', () => {
    assert.equal(departAt(lunch, table, ''), null, 'no drive time');
    assert.equal(departAt(lunch, { start_time: null }, '20 mins'), null, 'nothing to be on time for');
    assert.equal(departAt(lunch, null, '20 mins'), null);
});

it('does not push the leave time into yesterday', () => {
    assert.equal(departAt(lunch, { start_time: '00:30:00' }, '2 hours'), null);
});

it('does not need the current card to have a time', () => {
    const d = departAt({ start_time: null }, table, '30 mins');
    assert.equal(d.time, '18:30:00');
    assert.equal(d.tight, false, 'no length to run past');
});

/* --- where a new card lands ------------------------------------------ */

it('lands at the end of the day', () => {
    assert.equal(nextSlot([
        { start_time: '09:00:00', duration: '1 hour' },
        { start_time: '14:00:00', duration: '90 mins' },
    ]), '15:30:00');
});

it('falls back on an empty day', () => {
    assert.equal(nextSlot([]), '09:00:00');
    assert.equal(nextSlot([{ start_time: null }]), '09:00:00');
});

it('ignores the brainstorm board', () => {
    assert.equal(nextSlot([
        { start_time: '09:00:00', duration: '1 hour' },
        { start_time: '20:00:00', is_brainstorm: true },
    ]), '10:00:00');
});

it('assumes an hour when nothing says otherwise', () => {
    assert.equal(nextSlot([{ start_time: '17:00:00' }]), '18:00:00');
});

it('does not wrap past midnight', () => {
    assert.equal(nextSlot([{ start_time: '23:30:00', duration: '3 hours' }]), '23:59:00');
});

it('takes the last by time, not by position', () => {
    assert.equal(nextSlot([
        { start_time: '18:00:00', duration: '1 hour' },
        { start_time: '09:00:00', duration: '1 hour' },
    ]), '19:00:00');
});

console.log(`departAt: ${n} passed`);

/* --- being late ------------------------------------------------------- */
{
    const lunch = { start_time: '12:00:00', duration: '2 hours' };
    const table = { start_time: '19:00:00' };

    const fine = departAt(lunch, table, '45 mins');
    assert.equal(fine.late, 0, 'lunch is long over');

    const over = departAt({ start_time: '12:00:00', duration: '7 hours' }, table, '45 mins');
    assert.equal(over.late, 45, 'lunch runs to 7, you needed to leave at 6:15');
    assert.equal(over.tight, true);

    const exact = departAt({ start_time: '12:00:00', duration: '6:15' }, table, '45 mins');
    assert.equal(exact.late, 0, 'finishing exactly when you leave is not late');

    console.log('departAt: 3 more passed');
}
