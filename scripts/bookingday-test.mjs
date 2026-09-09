import assert from 'node:assert/strict';
import { dayChoices, daysOn, labelDay, nearestDays, spreadOnto } from '../src/utils/bookingDay.js';

let n = 0;
const t = (what, fn) => { fn(); n += 1; console.log(`  ok  ${what}`); };

const rows = [
    { id: 'b', date: '2026-09-08', city: 'New York', trip_id: 13, atlas_trips: { destination: 'NYC!' } },
    { id: 'a', date: '2026-09-03', city: 'New York', trip_id: 13, atlas_trips: { destination: 'NYC!' } },
    { id: 'c', date: '2026-01-31', city: 'San Francisco', trip_id: 9, atlas_trips: { destination: 'Ferry Building to Che Fico Date Day' } },
];

t('every day of every trip, flat and in date order', () => {
    const out = dayChoices(rows);
    assert.deepEqual(out.map((d) => d.id), ['c', 'a', 'b']);
    assert.equal(out[1].trip, 'NYC!');
    assert.equal(out[1].tripId, 13);
});

t('a day with no usable date is not a choice', () => {
    assert.equal(dayChoices([{ id: 'x', date: null }]).length, 0);
    assert.equal(dayChoices([{ id: 'x', date: '2026-09' }]).length, 0);
    assert.deepEqual(dayChoices(null), []);
});

t('a trip with no name still reads as something', () => {
    assert.equal(dayChoices([{ id: 'x', date: '2026-09-01' }])[0].trip, 'A trip');
});

t('the booking usually answers its own question', () => {
    const out = daysOn(dayChoices(rows), '2026-09-08');
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'b');
});

t('when two trips cover the same date she has to say which', () => {
    // A weekend inside a longer trip, or an old trip never given an end. The
    // first one must not silently win.
    const both = dayChoices([
        ...rows,
        { id: 'd', date: '2026-09-08', trip_id: 5, atlas_trips: { destination: 'Will in SF!' } },
    ]);
    assert.equal(daysOn(both, '2026-09-08').length, 2);
});

t('a booking with no date matches nothing rather than everything', () => {
    assert.deepEqual(daysOn(dayChoices(rows), null), []);
    assert.deepEqual(daysOn(dayChoices(rows), 'soon'), []);
});

t('a day says which trip and which day of it', () => {
    const [, day] = dayChoices(rows);
    assert.equal(labelDay(day, (d) => d), 'NYC! · New York — 2026-09-03');
    assert.equal(labelDay(null), '');
});

t('when nothing matches, what is near is the useful answer', () => {
    const near = nearestDays(dayChoices(rows), '2026-09-05', 3);
    assert.deepEqual(near.map((d) => d.date), ['2026-09-03', '2026-09-08']);
    assert.equal(near[0].away, -2);
    assert.equal(near[1].away, 3);
});

t('nothing near is an empty list, not the whole atlas', () => {
    assert.deepEqual(nearestDays(dayChoices(rows), '2027-06-01', 3), []);
});

/* A journey longer than a day arrives as one row per day it eats, and every
   one of them needs a day of the trip to land on. The interesting half is the
   half that has nowhere to go: a trip ending before the flight does. */
t('a spread finds a day of the trip for each of its dates', () => {
    const days = dayChoices([
        { id: 'a', date: '2026-12-23', trip_id: 't1', atlas_trips: { id: 't1', destination: 'India' } },
        { id: 'b', date: '2026-12-24', trip_id: 't1', atlas_trips: { id: 't1', destination: 'India' } },
        { id: 'c', date: '2026-12-25', trip_id: 't1', atlas_trips: { id: 't1', destination: 'India' } },
    ]);
    const { placed, missing } = spreadOnto(days, 't1', ['2026-12-23', '2026-12-24', '2026-12-25']);
    assert.deepEqual(placed.map((p) => p.day.id), ['a', 'b', 'c']);
    assert.deepEqual(missing, []);
});

t('a date the trip does not reach is reported, not dropped', () => {
    const days = dayChoices([
        { id: 'a', date: '2026-12-23', trip_id: 't1', atlas_trips: { id: 't1' } },
        { id: 'b', date: '2026-12-24', trip_id: 't1', atlas_trips: { id: 't1' } },
    ]);
    const { placed, missing } = spreadOnto(days, 't1', ['2026-12-23', '2026-12-24', '2026-12-25']);
    assert.deepEqual(placed.map((p) => p.date), ['2026-12-23', '2026-12-24']);
    // A card that was never written is a card she will look for and not find.
    assert.deepEqual(missing, ['2026-12-25']);
});

t('another trip covering the same date is not borrowed from', () => {
    const days = dayChoices([
        { id: 'a', date: '2026-12-23', trip_id: 't1', atlas_trips: { id: 't1' } },
        { id: 'x', date: '2026-12-24', trip_id: 't2', atlas_trips: { id: 't2' } },
    ]);
    const { placed, missing } = spreadOnto(days, 't1', ['2026-12-23', '2026-12-24']);
    assert.deepEqual(placed.map((p) => p.day.id), ['a']);
    assert.deepEqual(missing, ['2026-12-24']);
});

t('a trip with nothing in it places nothing and says so', () => {
    const { placed, missing } = spreadOnto([], 't1', ['2026-12-23', '2026-12-24']);
    assert.deepEqual(placed, []);
    assert.deepEqual(missing, ['2026-12-23', '2026-12-24']);
});

console.log(`\n${n} passed`);
