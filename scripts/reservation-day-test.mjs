/**
 * Putting a booked table on a day.
 *
 * The whole test is one trap. `starts_at` is a timestamptz, and reading a date
 * out of it in UTC — which is what `toISOString()` does — moves any evening
 * booking west of Greenwich onto the following day. So the dates are built
 * from local parts here, and the assertions are about local parts, which makes
 * this pass in any timezone and fail if the implementation ever reaches for
 * toISOString.
 */

import {
    localDate, localTime, bookingNote, asAtlasItem, dayOn, plus,
} from '../src/utils/reservationToDay.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

/* 6 Sep 2026, 20:45 — wherever this test is run. */
const evening = new Date(2026, 8, 6, 20, 45, 0).toISOString();
/* and half past midnight the same night, which is the 7th locally. */
const lateNight = new Date(2026, 8, 7, 0, 30, 0).toISOString();

console.log('\nthe date and time it is actually on:');
check('an evening booking is on that evening', localDate(evening), '2026-09-06');
check('not the next day in UTC', localDate(evening).endsWith('07'), false);
check('and the clock is the local clock', localTime(evening), '20:45:00');
check('after midnight is the next day', localDate(lateNight), '2026-09-07');
check('at half past twelve', localTime(lateNight), '00:30:00');
check('nonsense in, nothing out', localDate('not a date'), null);
check('and no time either', localTime(null), null);

console.log('\nwhat gets written under the name:');
const r = {
    name: 'Nari', starts_at: evening, party_size: 4, seating: 'Main dining room',
    platform: 'Resy', confirmation: 'RSY-8841Q', address: '1625 Post St, San Francisco',
    maps_url: 'https://maps.google.com/?cid=1',
};
check('everything worth reading at the door', bookingNote(r),
    'Party of 4 · Main dining room · Booked via Resy · Confirmation RSY-8841Q');
check('a bare booking says little', bookingNote({ name: 'X' }), '');

console.log('\nas a trip item:');
const atlas = asAtlasItem(r);
check('the booking names the card', atlas.title, 'Nari');
check('a table is food, so it counts as food', atlas.kind, 'food');
check('with its local time', atlas.start_time, '20:45:00');
check('a table runs two hours unless told otherwise', atlas.end_time, '22:45:00');
check('the address is the location', atlas.location, '1625 Post St, San Francisco');
check('a nameless one still has a name', asAtlasItem({}).title, 'Reservation');
check('the map link comes across', atlas.link, 'https://maps.google.com/?cid=1');
check('a website will do if there is no map link',
    asAtlasItem({ restaurant: 'X', website: 'https://x.com' }).link, 'https://x.com');
check('and nothing if there is neither', asAtlasItem({ restaurant: 'X' }).link, null);

console.log('\nadding minutes to a time:');
check('an ordinary evening', plus('19:30:00', 120), '21:30:00');
check('over midnight wraps rather than reaching 24', plus('23:00:00', 120), '01:00:00');
check('exactly midnight is 00:00', plus('22:00:00', 120), '00:00:00');
check('no time in, no time out', plus(null, 120), null);

console.log('\nfinding the day:');
const days = [{ id: 'a', date: '2026-09-05' }, { id: 'b', date: '2026-09-06' }];
check('matched on the local date', dayOn(evening, days)?.id, 'b');
check('a night that rolls over goes to the next day', dayOn(lateNight, days), null);
check('itineraries match on their own column', dayOn(evening, [
    { id: 'p', planned_date: '2026-09-06' },
], 'planned_date')?.id, 'p');
check('nothing to match against', dayOn(evening, []), null);

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
