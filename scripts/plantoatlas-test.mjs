/**
 * Sending a day plan into an Atlas trip.
 *
 * Two things here are worth a test rather than a look. Durations are free
 * text — the field was never constrained, so it holds "2 hours", "1:30", "90
 * min" and bare numbers, and reading a bare 90 as ninety hours puts the end
 * of a museum visit next Thursday. And brainstorm cards have no time at all;
 * dropping them would lose the half of the day that was still being decided.
 */

import {
    kindOf, minutesOf, endTime, dayFor, atlasItemsFrom, describeSend,
} from '../src/utils/planToAtlas.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

console.log('\nwhat sort of thing it is:');
check('dinner is food', kindOf('Dinner at Masque'), 'food');
check('so is coffee', kindOf('coffee with Ada'), 'food');
check('and drinks', kindOf('Drinks at the roof bar'), 'food');
check('a museum is not', kindOf('Prince of Wales Museum'), 'todo');
check('and neither is "barbershop", which merely contains bar', kindOf('barbershop'), 'todo');
check('nothing is a to-do', kindOf(''), 'todo');

console.log('\nreading a duration nobody constrained:');
check('a clock is hours and minutes', minutesOf('1:30'), 90);
check('minutes said as minutes', minutesOf('90 min'), 90);
check('hours said as hours', minutesOf('2 hours'), 120);
check('and abbreviated', minutesOf('2h'), 120);
check('half an hour', minutesOf('0.5 hours'), 30);
check('a small bare number is hours', minutesOf('2'), 120);
check('a large one is minutes — nobody means ninety hours', minutesOf('90'), 90);
check('nothing is nothing', minutesOf(''), null);
check('so is a word', minutesOf('a while'), null);
check('and zero', minutesOf('0'), null);

console.log('\nwhen it ends:');
check('start plus duration', endTime('09:00:00', '2 hours'), '11:00:00');
check('minutes carry', endTime('09:45:00', '90 min'), '11:15:00');
check('no duration, no end', endTime('09:00:00', ''), null);
check('no start, no end', endTime(null, '2 hours'), null);
check('past midnight lands on midnight, not 24:00', endTime('23:00:00', '3 hours'), '00:00:00');

console.log('\nwhich day of the trip:');
const days = [
    { id: 'd1', date: '2026-12-26' },
    { id: 'd2', date: '2026-12-27T00:00:00+00:00' },
];
check('matched on the date', dayFor('2026-12-26', days)?.id, 'd1');
check('a timestamp is still that date', dayFor('2026-12-27', days)?.id, 'd2');
check('a date the trip does not cover', dayFor('2027-01-01', days), null);
check('no date, no day', dayFor(null, days), null);

console.log('\nthe items themselves:');
const planItems = [
    { activity: 'Lunch at Gott’s', start_time: '12:30:00', duration: '1 hour', cost: '40', link: 'https://maps…', is_brainstorm: false },
    { activity: 'Winery tasting', start_time: '09:00:00', duration: '2', location: 'Rudd Estate', is_brainstorm: false },
    { activity: 'Maybe the hot springs', is_brainstorm: true },
    { activity: '   ', is_brainstorm: true },
];
const mapped = atlasItemsFrom(planItems);
check('the untitled one is dropped', mapped.length, 3);
check('timed ones come first, in order', mapped.map((i) => i.title), [
    'Winery tasting', 'Lunch at Gott’s', 'Maybe the hot springs',
]);
check('with their hours', mapped[0].start_time, '09:00:00');
check('and their ends worked out', mapped[0].end_time, '11:00:00');
check('lunch is food', mapped[1].kind, 'food');
check('its cost comes as a number', mapped[1].cost, 40);
check('its link comes across', mapped[1].link, 'https://maps…');
check('a brainstorm card keeps no time', [mapped[2].start_time, mapped[2].end_time], [null, null]);
check('and sorts last', mapped[2].sort_order, 2);
check('nothing in, nothing out', atlasItemsFrom([]), []);

console.log('\nsaying what would happen:');
check('a plan with no date cannot be placed', describeSend({ planned_date: null }, days, planItems).ok, false);
check('nor one dated outside the trip', describeSend({ planned_date: '2027-05-05' }, days, planItems).ok, false);
check('an empty plan has nothing to send', describeSend({ planned_date: '2026-12-26' }, days, []).ok, false);
const good = describeSend({ planned_date: '2026-12-26' }, days, planItems);
check('a dated plan on a covered day is ready', good.ok, true);
check('and knows which day', good.day.id, 'd1');
check('and how much it is sending', good.items.length, 3);

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
