/**
 * The reservation sweep.
 *
 * Everything here turns on a comparison with "now", which is exactly the sort
 * of thing that works on the day you write it and is wrong the following week.
 * So `now` is a parameter and the tests pin it.
 */

import { unsettled, deadlines, clashes, sweep } from '../src/utils/reservationSweep.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

const NOW = Date.parse('2026-08-28T12:00:00Z');
const hours = (n) => new Date(NOW + n * 3600000).toISOString();
const days = (n) => new Date(NOW + n * 86400000).toISOString();

const rows = [
    { id: 'a', restaurant: 'Masque', starts_at: days(-3), status: 'booked' },
    { id: 'b', restaurant: 'Trishna', starts_at: days(-10), status: 'dined' },
    { id: 'c', restaurant: 'Bombay Canteen', starts_at: days(-1), status: 'booked' },
    { id: 'd', restaurant: 'Americano', starts_at: days(2), status: 'booked', cancel_by: days(1) },
    { id: 'e', restaurant: 'Ekaa', starts_at: days(9), status: 'booked', cancel_by: days(7) },
    { id: 'f', restaurant: 'Papa', starts_at: days(4), status: 'booked', cancel_by: days(-1) },
    { id: 'g', restaurant: 'Cancelled one', starts_at: days(-2), status: 'cancelled' },
];

console.log('\nwhat happened to the ones that have been and gone:');
check('only past bookings nobody settled', unsettled(rows, NOW).map((r) => r.id), ['c', 'a']);
check('a dined one is settled', unsettled(rows, NOW).some((r) => r.id === 'b'), false);
check('so is a cancelled one', unsettled(rows, NOW).some((r) => r.id === 'g'), false);
check('nothing to settle in an empty book', unsettled([], NOW), []);

console.log('\ncancellation deadlines:');
const dl = deadlines(rows, NOW);
check('one is close', dl.soon.map((r) => r.id), ['d']);
check('a week out is not yet news', dl.soon.some((r) => r.id === 'e'), false);
check('and one has already gone by', dl.missed.map((r) => r.id), ['f']);
check('a wider window catches the far one', deadlines(rows, NOW, 10).soon.map((r) => r.id), ['d', 'e']);

console.log('\ntwo tables at once:');
const near = [
    { id: 'x', restaurant: 'One', starts_at: hours(50), status: 'booked' },
    { id: 'y', restaurant: 'Two', starts_at: hours(51), status: 'booked' },
    { id: 'z', restaurant: 'Three', starts_at: hours(80), status: 'booked' },
];
check('an hour apart is a clash', clashes(near, NOW).map((p) => p.map((r) => r.id)), [['x', 'y']]);
check('a day apart is not', clashes([near[0], near[2]], NOW), []);
check('a booking already past cannot clash', clashes(rows, NOW), []);

console.log('\nall together:');
const all = sweep(rows, NOW);
check('the count adds up', all.count, 2 + 1 + 1 + 0);
check('an empty book is quiet', sweep([], NOW).count, 0);

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
