import assert from 'node:assert/strict';
import { dayChoices, daysOn, labelDay, nearestDays } from '../src/utils/bookingDay.js';

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

console.log(`\n${n} passed`);
