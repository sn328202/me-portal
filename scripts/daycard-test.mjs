import assert from 'node:assert/strict';
import { faceFor, clock, spell, longDate, hopBetween, dayCard, tripCard } from '../src/utils/dayCard.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

it('picks the face from the words', () => {
    assert.equal(faceFor('Dinner at Masque'), '🍽️');
    assert.equal(faceFor('Coffee at Blue Tokai'), '☕');
    assert.equal(faceFor('Flight to Kochi'), '✈️');
    assert.equal(faceFor('Hike up the ridge'), '🥾');
    assert.equal(faceFor('Check in at the riad'), '🛏️');
});

it('reads in order, so breakfast beats the beach', () => {
    assert.equal(faceFor('Pastries at the beach bakery'), '🥐');
});

it('falls back to the kind, then to a pin', () => {
    assert.equal(faceFor('Somewhere', 'food'), '🍽️');
    assert.equal(faceFor('Somewhere'), '📍');
    assert.equal(faceFor(''), '📍');
    assert.equal(faceFor(null), '📍');
});

it('tells the time for reading', () => {
    assert.equal(clock('09:00:00'), '9:00 am');
    assert.equal(clock('14:05:00'), '2:05 pm');
    assert.equal(clock('00:30:00'), '12:30 am');
    assert.equal(clock('12:00:00'), '12:00 pm');
    assert.equal(clock(null), null);
});

it('spells a length out', () => {
    assert.equal(spell('90 mins'), '1 hr 30 min');
    assert.equal(spell('2 hours'), '2 hr');
    assert.equal(spell('45 min'), '45 min');
    assert.equal(spell(''), null);
});

it('reads a date without a timezone moving it', () => {
    assert.equal(longDate('2026-09-12'), 'Saturday, 12 September');
    assert.equal(longDate('2026-01-01'), 'Thursday, 1 January');
    assert.equal(longDate('nonsense'), null);
});

it('says when to leave', () => {
    const hop = hopBetween({ minutes: 720 }, { minutes: 1140 }, '45 mins');
    assert.equal(hop.travel, '45 min');
    assert.equal(hop.leaveBy, '6:15 pm');
});

it('says nothing rather than something negative', () => {
    assert.equal(hopBetween({ minutes: 0 }, { minutes: 30 }, '2 hours').leaveBy, null);
    assert.equal(hopBetween({ minutes: 720 }, null, '20 mins'), null);
    assert.equal(hopBetween({ minutes: 720 }, { minutes: 800 }, ''), null);
});

/* --- the whole page --------------------------------------------------- */

const items = [
    { id: 'b', activity: 'Dinner at Masque', start_time: '19:00:00', duration: '2 hours', location: 'Mathuradas Mills', cost: 4000 },
    { id: 'a', activity: 'Coffee', start_time: '09:00:00', duration: '45 min', location: 'Kala Ghoda' },
    { id: 'c', activity: 'Maybe the museum', is_brainstorm: true },
    { id: 'd', activity: '   ' },
];

it('builds a page in time order', () => {
    const card = dayCard({ title: 'Bombay Saturday', date: '2026-09-12', items, travel: { a: '30 mins' } });
    assert.equal(card.title, 'Bombay Saturday');
    assert.equal(card.date, 'Saturday, 12 September');
    assert.deepEqual(card.stops.map((s) => s.title), ['Coffee', 'Dinner at Masque']);
    assert.equal(card.stops[0].face, '☕');
    assert.equal(card.stops[1].at, '7:00 pm');
    assert.equal(card.stops[1].length, '2 hr');
});

it('keeps the maybes out of the timed run', () => {
    const card = dayCard({ title: 'x', date: '2026-09-12', items });
    assert.equal(card.loose.length, 1);
    assert.equal(card.loose[0].title, 'Maybe the museum');
});

it('drops cards with no name', () => {
    const card = dayCard({ title: 'x', date: '2026-09-12', items });
    assert.equal(card.stops.length + card.loose.length, 3, 'the blank one is gone');
});

it('works out the hop and the shape of the day', () => {
    const card = dayCard({ title: 'x', date: '2026-09-12', items, travel: { a: '30 mins' } });
    assert.equal(card.hops[0].leaveBy, '6:30 pm');
    assert.equal(card.hops[1], null, 'nothing after the last stop');
    assert.equal(card.window, '9:00 am – 7:00 pm');
    assert.equal(card.spend, 4000);
});

it('reads an Atlas item, which says when it ends rather than how long', () => {
    const card = dayCard({
        title: 'x', date: '2026-09-12',
        items: [{ id: 'z', title: 'Fort walk', kind: 'todo', start_time: '10:00:00', end_time: '11:30:00' }],
    });
    assert.equal(card.stops[0].length, '1 hr 30 min');
});

it('says when there is nothing on it', () => {
    assert.equal(dayCard({ title: 'x', date: '2026-09-12', items: [] }).empty, true);
    assert.equal(dayCard({ title: 'x', date: '2026-09-12', items }).empty, false);
});

it('never says spend when nothing costs anything', () => {
    assert.equal(dayCard({ title: 'x', date: '2026-09-12', items: [{ title: 'Walk', start_time: '09:00:00' }] }).spend, null);
});

it('makes a trip out of its days, skipping the empty ones', () => {
    const card = tripCard({
        // `destination` is the field the Atlas puts her own words in, so it
        // wins. This used to assert the opposite and was wrong.
        trip: { destination: 'India (Goa / Kerala)' },
        days: [{ id: 1, date: '2026-09-12' }, { id: 2, date: '2026-09-13' }],
        itemsByDay: { 1: [{ title: 'Backwaters', start_time: '08:00:00' }], 2: [] },
    });
    assert.equal(card.title, 'India (Goa / Kerala)');
    assert.equal(card.days.length, 1);
    assert.equal(card.days[0].title, 'Saturday, 12 September');
});

console.log(`dayCard: ${n} passed`);

/* --- a trip is called what she called it ------------------------------ */
{
    const { tripCard } = await import('../src/utils/dayCard.js');
    let m = 0;
    const t = (fn) => { fn(); m += 1; };

    const days = [{ id: 1, date: '2026-08-29' }];
    const items = { 1: [{ title: 'Lunch', start_time: '12:00:00' }] };

    t(() => {
        // `destination` is where the Atlas keeps her own words. Reading
        // `name`/`title` — which no trip has — headed every sheet "A trip".
        const card = tripCard({ trip: { destination: 'Will in SF!' }, days, itemsByDay: items });
        assert.equal(card.title, 'Will in SF!');
        assert.equal(card.subtitle, null, 'no second line repeating it');
    });

    t(() => {
        assert.equal(tripCard({ trip: {}, days, itemsByDay: items }).title, 'A trip');
        assert.equal(tripCard({ trip: { destination: '   ' }, days, itemsByDay: items }).title, 'A trip');
    });

    console.log(`tripCard name: ${m} passed`);
}

// A day whose only name is its date should not print the date twice.
{
    const c = dayCard({ title: 'Saturday, 29 August', date: '2026-08-29', items: [{ id: 1, title: 'Lunch', start_time: '11:00' }] });
    assert.equal(c.title, 'Saturday, 29 August');
    assert.equal(c.date, null, 'the date line is dropped when it repeats the title');
}

// A day with a real name of its own keeps both.
{
    const c = dayCard({ title: 'Napa Valley', date: '2026-08-30', items: [{ id: 1, title: 'Lunch', start_time: '11:00' }] });
    assert.equal(c.title, 'Napa Valley');
    assert.ok(c.date && c.date.length > 0, 'a named day still says which day it is');
}
console.log('date line: 2 passed');
