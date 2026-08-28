/**
 * The order of a day.
 *
 * The first two of these are the bugs that made the itinerary feel flaky:
 * a comparator that said each of two cards came after the other, and a drop
 * rule that gave the card a time *after* the card it was dropped in front of,
 * so the re-sort moved it somewhere else.
 */

import { asMinutes, asTime, compareItems, lengthOf, timeBetween } from '../src/utils/dayOrder.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

console.log('\nclock:');
check('a time is minutes', asMinutes('09:30:00'), 570);
check('nothing is null', asMinutes(''), null);
check('minutes are a time', asTime(570), '09:30:00');
check('and cannot leave the day', asTime(2000), '23:59:00');

console.log('\nthe comparator is consistent:');
const timed = { start_time: '09:00:00' };
const later = { start_time: '11:00:00' };
const untimedA = { id: 'a' };
const untimedB = { id: 'b' };
const idea = { is_brainstorm: true };
check('earlier comes first', compareItems(timed, later) < 0, true);
check('and the reverse is the reverse', compareItems(later, timed) > 0, true);
check('untimed goes after timed', compareItems(untimedA, timed) > 0, true);
check('and timed before untimed', compareItems(timed, untimedA) < 0, true);
check('two untimed are equal — this was the bug', compareItems(untimedA, untimedB), 0);
check('and equal both ways round', compareItems(untimedB, untimedA), 0);
check('an idea goes last', compareItems(idea, untimedA) > 0, true);
check('two ideas are equal', compareItems(idea, { is_brainstorm: true }), 0);

console.log('\nand it actually sorts:');
const day = [idea, untimedA, later, timed, untimedB];
check('into a sensible order', [...day].sort(compareItems).map((i) => i.start_time || i.id || 'idea'),
    ['09:00:00', '11:00:00', 'a', 'b', 'idea']);

console.log('\nhow long a card takes:');
check('from its duration', lengthOf({ duration: '2 hours' }), 120);
check('an hour by default', lengthOf({}), 60);
check('and when the duration is nonsense', lengthOf({ duration: 'a while' }), 60);

console.log('\nwhere a dropped card lands:');
check('an empty day starts at nine', timeBetween(null, null), '09:00:00');
check('dropped above everything', timeBetween(null, { start_time: '10:00:00' }), '09:00:00');
check('dropped at the end, after the last one finishes',
    timeBetween({ start_time: '14:00:00', duration: '90 min' }, null), '15:30:00');
check('with room, it runs its full length',
    timeBetween({ start_time: '09:00:00', duration: '1 hour' }, { start_time: '12:00:00' }), '10:00:00');

/* The bug: 9am + 2h = 11am, which is after the 10am card it was dropped
   in front of, so the re-sort moved it back past that card. */
const squeezed = timeBetween({ start_time: '09:00:00', duration: '2 hours' }, { start_time: '10:00:00' });
check('with no room it still lands between them', squeezed, '09:30:00');
check('strictly after the one above', asMinutes(squeezed) > asMinutes('09:00:00'), true);
check('and strictly before the one below', asMinutes(squeezed) < asMinutes('10:00:00'), true);

const packed = timeBetween({ start_time: '09:00:00', duration: '3 hours' }, { start_time: '09:01:00' });
check('a day packed to the minute still finds one', packed, '09:01:00');

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
