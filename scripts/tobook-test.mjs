import assert from 'node:assert/strict';
import { daysBetween, whenLabel, urgency, toBookList, overdue, describeToBook } from '../src/utils/toBook.js';

let n = 0;
const t = (what, fn) => { fn(); n += 1; console.log(`  ok  ${what}`); };
const TODAY = '2026-09-01';

t('days are counted whole, and backwards too', () => {
    assert.equal(daysBetween(TODAY, '2026-09-04'), 3);
    assert.equal(daysBetween(TODAY, '2026-09-01'), 0);
    assert.equal(daysBetween(TODAY, '2026-08-30'), -2);
    assert.equal(daysBetween(TODAY, null), null);
});

t('a month boundary is not a special case', () => {
    assert.equal(daysBetween('2026-08-30', '2026-09-02'), 3);
});

t('how soon, in words rather than arithmetic', () => {
    assert.equal(whenLabel('2026-09-01', TODAY), 'Today');
    assert.equal(whenLabel('2026-09-02', TODAY), 'Tomorrow');
    assert.equal(whenLabel('2026-09-08', TODAY), 'In 7 days');
    assert.equal(whenLabel('2026-08-31', TODAY), 'Was yesterday');
    assert.equal(whenLabel('2026-08-25', TODAY), 'Was 7 days ago');
    assert.equal(whenLabel(null, TODAY), 'No date');
});

t('urgency has a shape', () => {
    assert.equal(urgency('2026-08-30', TODAY), 'gone');
    assert.equal(urgency('2026-09-01', TODAY), 'now');
    assert.equal(urgency('2026-09-03', TODAY), 'now');
    assert.equal(urgency('2026-09-04', TODAY), 'soon');
    assert.equal(urgency('2026-09-15', TODAY), 'soon');
    assert.equal(urgency('2026-09-16', TODAY), 'later');
    assert.equal(urgency(null, TODAY), 'undated');
});

// ---- the list -----------------------------------------------------------

const rows = [
    { id: 'c', title: 'Itria', start_time: '19:30:00', atlas_days: { date: '2026-09-04', city: 'SF', trip_id: 5, atlas_trips: { destination: 'Will in SF!' } } },
    { id: 'a', title: 'Ad Hoc', start_time: '11:00:00', atlas_days: { date: '2026-09-04', city: 'Napa', trip_id: 5, atlas_trips: { destination: 'Will in SF!' } } },
    { id: 'b', title: 'Che Fico', start_time: null, atlas_days: { date: '2026-09-02', trip_id: 9, atlas_trips: { destination: 'Date Day' } } },
];

t('the list is flat, and in the order the calls have to happen', () => {
    const out = toBookList(rows, TODAY);
    assert.deepEqual(out.map((i) => i.id), ['b', 'a', 'c']);
    assert.equal(out[0].trip, 'Date Day');
    assert.equal(out[1].at, '11:00');
    assert.equal(out[0].when, 'Tomorrow');
});

t('within a day, by the clock', () => {
    const out = toBookList(rows, TODAY).filter((i) => i.date === '2026-09-04');
    assert.deepEqual(out.map((i) => i.at), ['11:00', '19:30']);
});

t('within a day, things with no time come after the timed ones', () => {
    // The same rule the timeline itself uses (utils/dayOrder). Two orderings
    // for the same day, in the same app, is a worse answer than either.
    const out = toBookList([
        { id: 'x', title: 'B', start_time: '09:00:00', atlas_days: { date: '2026-09-05' } },
        { id: 'y', title: 'A', start_time: null, atlas_days: { date: '2026-09-05' } },
    ], TODAY);
    assert.deepEqual(out.map((i) => i.id), ['x', 'y']);
});

t('an undated thing goes last, not first', () => {
    // An empty date string sorts before every real one, which would put the
    // vaguest thing at the top of a queue of phone calls.
    const out = toBookList([
        { id: 'dated', title: 'A', atlas_days: { date: '2026-12-01' } },
        { id: 'undated', title: 'B', atlas_days: {} },
    ], TODAY);
    assert.deepEqual(out.map((i) => i.id), ['dated', 'undated']);
});

t('an unnamed thing is still on the list', () => {
    assert.equal(toBookList([{ id: 'z', title: '  ', atlas_days: { date: '2026-09-03' } }], TODAY)[0].title, 'Something');
});

t('nothing is an empty list, not a crash', () => {
    assert.deepEqual(toBookList(null, TODAY), []);
    assert.equal(overdue(null), 0);
});

t('the line at the top counts what has already been', () => {
    assert.equal(describeToBook([]), 'Nothing waiting on a phone call.');
    const list = toBookList([
        ...rows,
        { id: 'old', title: 'Gone', atlas_days: { date: '2026-08-20' } },
    ], TODAY);
    assert.equal(overdue(list), 1);
    assert.equal(describeToBook(list), '4 still to book · 1 already been');
});

console.log(`\n${n} passed`);
