/**
 * Dragging on the hour grid.
 *
 * All of this is off-by-one country. A drag from the 9am row to the 11am row
 * covers three rows and means 9 until 12, because you select the hours and an
 * hour has a far end. An hour short looks completely fine and is wrong every
 * single time, which is exactly why it needs a test rather than a look.
 */

import {
    HOURS, hoursFor, hourToTime, timeToHour, startHour, spanOf, rowsFor, dragRange,
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
/* The trap: midnight is stored as 00:00, which as hour 0 sorts six hours
   before the grid begins and would never be drawn at all. A thing *typed* at
   midnight — which is what dragging the last row makes, 00:00 to 00:00 —
   belongs at the bottom of the day it was put on.

   An item that starts at midnight and ends an hour later is a different
   claim: it is the first hour of the day, and it says so. That used to be
   drawn at the bottom too, because the grid began at six and there was
   nowhere else to put it. There is now — `hoursFor` stretches the grid back
   for a day that needs it — so it is drawn where it says it is. */
check('a thing dragged onto the midnight row stays at the bottom',
    rowsFor({ start_time: '00:00:00', end_time: '00:00:00' }), { start: 18, span: 1 });
check('but an hour after midnight is the top of the day, on a grid that reaches it',
    rowsFor({ start_time: '00:00:00', end_time: '01:00:00' },
        hoursFor([{ start_time: '00:00:00', end_time: '01:00:00' }])),
    { start: 0, span: 1 });
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

console.log('\nmidnight, which is two different things:');
/* As a lone start it means late — the bottom of the day, not six hours before
   the grid begins. That reading is why hour 0 becomes 24. */
check('a thing typed at midnight sits at the bottom of its day',
    spanOf({ start_time: '00:00:00' }), { from: 24, to: 25 });
check('and so does one that ends at midnight too',
    spanOf({ start_time: '00:00:00', end_time: '00:00:00' }), { from: 24, to: 25 });
/* But a card from 00:00 to 23:59 is a whole day — a flight already in the air
   when midnight passed. Sent to the bottom it drew as one row at the end of a
   day it in fact filled. */
check('a day-long block starts at the top of the day',
    spanOf({ start_time: '00:00:00', end_time: '23:59:00' }), { from: 0, to: 23 });
check('as does one that ends mid-morning',
    spanOf({ start_time: '00:00:00', end_time: '06:15:00' }), { from: 0, to: 6 });

/* The geometry and the label must agree about midnight. They did not: a
   day-long transit card drew full height and read "12am", with no end and no
   length, because the label put its start at hour 24 and its end at 23:59 and
   concluded the thing finished before it started. One function decides now. */
check('a day-long block reads as a day, not as a moment',
    timeLabel({ start_time: '00:00:00', end_time: '23:59:00' }).range, '12am–11:59pm');
check('and its length is a day', 
    timeLabel({ start_time: '00:00:00', end_time: '23:59:00' }).length, '23h 59m');
check('a card dragged onto the midnight row is still just a moment',
    timeLabel({ start_time: '00:00:00', end_time: '00:00:00' }).range, '12am');
check('an evening ending at midnight is unchanged',
    timeLabel({ start_time: '22:00:00', end_time: '00:00:00' }).range, '10pm–12am');
check('the label and the block read the start the same way',
    [startHour({ start_time: '00:00:00', end_time: '23:59:00' }),
        spanOf({ start_time: '00:00:00', end_time: '23:59:00' }).from], [0, 0]);
check('and the same way when there is no end',
    [startHour({ start_time: '00:00:00' }), spanOf({ start_time: '00:00:00' }).from], [24, 24]);

console.log('\nthe grid stretching for an early start:');
check('an ordinary day keeps the shape it has',
    hoursFor([{ start_time: '09:00:00', end_time: '17:00:00' }]), HOURS);
check('and so does an empty one', hoursFor([]), HOURS);
/* Her flight out of Mumbai leaves at 1:35am. On a grid beginning at six it
   did not draw at all — `rowsFor` correctly returns null for something
   entirely above the first row, so the card existed and was nowhere. */
{
    const early = hoursFor([{ start_time: '01:35:00', end_time: '19:35:00' }]);
    check('a 1:35am departure pulls the grid back to one',
        [early[0], early[early.length - 1], early.length], [1, 24, 24]);
    check('and then it actually draws',
        rowsFor({ start_time: '01:35:00', end_time: '19:35:00' }, early), { start: 0, span: 18 });
    check('which it did not before',
        rowsFor({ start_time: '01:35:00', end_time: '05:00:00' }, HOURS), null);
}
/* One grid is shared across the days on screen: a column starting at 6 and its
   neighbour at 1 would put the same hour on two different rows. */
check('the earliest thing on any day sets the grid for all of them',
    hoursFor([
        { start_time: '09:00:00' },
        { start_time: '03:00:00', end_time: '11:00:00' },
        { start_time: '14:00:00' },
    ])[0], 3);
check('a lone midnight card does not drag the grid back twenty-four hours',
    hoursFor([{ start_time: '00:00:00' }]), HOURS);
check('and nor does one dragged onto the midnight row',
    hoursFor([{ start_time: '00:00:00', end_time: '00:00:00' }]), HOURS);
check('but a day-long one does, because it starts the day',
    hoursFor([{ start_time: '00:00:00', end_time: '23:59:00' }])[0], 0);

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
