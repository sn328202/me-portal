/**
 * Dragging on the hour grid.
 *
 * All of this is off-by-one country. A drag from the 9am row to the 11am row
 * covers three rows and means 9 until 12, because you select the hours and an
 * hour has a far end. An hour short looks completely fine and is wrong every
 * single time, which is exactly why it needs a test rather than a look.
 */

import {
    HOURS, hourToTime, timeToHour, spanOf, rowsFor, dragRange,
    timesFromDrag, movedTo, describeSpan, timeLabel, clockLabel, lengthLabel,
} from '../src/utils/timeline.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

console.log('\nclock and rows:');
check('the grid runs 6am to midnight', [HOURS[0], HOURS.at(-1), HOURS.length], [6, 24, 19]);
check('an hour becomes a time Postgres takes', hourToTime(9), '09:00:00');
check('midnight is 00, not 24', hourToTime(24), '00:00:00');
check('and it is clamped, not wrapped twice', hourToTime(30), '00:00:00');
check('a time becomes an hour', timeToHour('09:30:00'), 9);
check('no time is no hour', timeToHour(null), null);

console.log('\nhow long something is:');
check('no end means one row', spanOf({ start_time: '09:00:00' }), { from: 9, to: 10 });
check('an end is honoured',
    spanOf({ start_time: '09:00:00', end_time: '12:00:00' }), { from: 9, to: 12 });
// Midnight at the end of a day is the end of the day, not six hours before it.
check('midnight as an end is the end of the day',
    spanOf({ start_time: '18:00:00', end_time: '00:00:00' }), { from: 18, to: 24 });
check('an end before the start is one row',
    spanOf({ start_time: '18:00:00', end_time: '09:00:00' }), { from: 18, to: 19 });
check('an untimed thing has no span', spanOf({ start_time: null }), null);

console.log('\nwhere it sits in the grid:');
check('9am is the fourth row down', rowsFor({ start_time: '09:00:00' }), { start: 3, span: 1 });
check('9 to 12 is three rows',
    rowsFor({ start_time: '09:00:00', end_time: '12:00:00' }), { start: 3, span: 3 });
// A 3am flight is real, but it is not on a grid that starts at six.
check('something before the grid starts is clipped to it',
    rowsFor({ start_time: '03:00:00', end_time: '08:00:00' }), { start: 0, span: 2 });
check('something entirely before it is not drawn',
    rowsFor({ start_time: '02:00:00', end_time: '05:00:00' }), null);
// 10pm to midnight covers the 10 and 11 rows; the midnight row is where
// midnight *starts*, not where the evening ends.
check('an evening ending at midnight stops before the midnight row',
    rowsFor({ start_time: '22:00:00', end_time: '00:00:00' }), { start: 16, span: 2 });
// The trap: midnight is stored as 00:00, which as hour 0 sorts six hours
// before the grid begins and would never be drawn at all.
check('something at midnight lands on the midnight row, not off the top',
    rowsFor({ start_time: '00:00:00', end_time: '01:00:00' }), { start: 18, span: 1 });
check('and dragging the last row produces exactly that',
    rowsFor(timesFromDrag(24, 24)), { start: 18, span: 1 });

console.log('\nthe drag itself:');
// The one that matters: three rows selected is three hours, 9 until 12.
check('9 to 11 selects three hours', dragRange(9, 11), { from: 9, to: 12 });
check('a single cell is one hour', dragRange(9, 9), { from: 9, to: 10 });
// People drag both ways and refusing one reads as a bug.
check('dragging upwards is the same selection', dragRange(11, 9), dragRange(9, 11));
check('a drag becomes the two fields an item stores',
    timesFromDrag(9, 11), { start_time: '09:00:00', end_time: '12:00:00' });
check('a drag to the last row ends at midnight',
    timesFromDrag(23, 23), { start_time: '23:00:00', end_time: '00:00:00' });

console.log('\nmoving one:');
const twoHours = { start_time: '09:00:00', end_time: '11:00:00' };
check('a two-hour block stays two hours',
    movedTo(twoHours, 14), { start_time: '14:00:00', end_time: '16:00:00' });
check('and cannot be dropped off the end of the day',
    movedTo(twoHours, 23), { start_time: '23:00:00', end_time: '00:00:00' });
check('nor before it starts', movedTo(twoHours, 2), { start_time: '06:00:00', end_time: '08:00:00' });
check('a one-hour thing stays one hour',
    movedTo({ start_time: '09:00:00' }, 20), { start_time: '20:00:00', end_time: '21:00:00' });

console.log('\nsaying it out loud:');
check('a span reads as a range', describeSpan(twoHours), '9am – 11am');
check('one hour is just the hour', describeSpan({ start_time: '09:00:00' }), '9am');
check('noon is 12pm, not 0pm',
    describeSpan({ start_time: '12:00:00', end_time: '13:00:00' }), '12pm');
check('an evening block crosses the meridiem',
    describeSpan({ start_time: '11:00:00', end_time: '14:00:00' }), '11am – 2pm');
check('nothing to say about an untimed thing', describeSpan({ start_time: null }), '');

/* ---- what a block says about itself ------------------------------- */

check('a start with no end says when, and nothing about how long',
    timeLabel({ start_time: '09:00:00' }),
    { at: '9am', till: null, length: null, range: '9am' });

check('a real half-hour is not rounded to the row it sits in',
    timeLabel({ start_time: '19:30:00', end_time: '21:00:00' }),
    { at: '7:30pm', till: '9pm', length: '1h 30m', range: '7:30pm\u20139pm' });

check('a whole-hour span reads in whole hours',
    timeLabel({ start_time: '09:00:00', end_time: '11:00:00' }),
    { at: '9am', till: '11am', length: '2h', range: '9am\u201311am' });

// Midnight is the end of the day, not six hours before the start.
check('an evening that runs to midnight is two hours, not minus twenty-two',
    timeLabel({ start_time: '22:00:00', end_time: '00:00:00' }),
    { at: '10pm', till: '12am', length: '2h', range: '10pm\u201312am' });

check('an end at or before the start is no length at all',
    timeLabel({ start_time: '14:00:00', end_time: '14:00:00' }),
    { at: '2pm', till: null, length: null, range: '2pm' });

check('an untimed item has nothing to say', timeLabel({ start_time: null }), null);

check('noon and midnight are twelve, not zero', clockLabel(12), '12pm');
check('and midnight reads as twelve too', clockLabel(24), '12am');
check('minutes only show when there are any', clockLabel(9, 0), '9am');

check('under an hour is minutes', lengthLabel(45), '45m');
check('a round hour drops the minutes', lengthLabel(120), '2h');
check('and a ragged one keeps them', lengthLabel(95), '1h 35m');
check('nothing is nothing', lengthLabel(0), '');

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
