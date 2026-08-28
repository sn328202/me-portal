import assert from 'node:assert/strict';
import { tripName, tripSeed, stretch, newDates, describeStretch } from '../src/utils/tripFromPlan.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

it('names a trip after the place, not the corner', () => {
    assert.equal(tripName({ location: 'Kala Ghoda, Fort, Mumbai', title: 'A Saturday' }), 'Kala Ghoda');
    assert.equal(tripName({ location: 'Lisbon' }), 'Lisbon');
});

it('falls back to her title before it falls back to nothing', () => {
    assert.equal(tripName({ location: '', title: 'Sintra day trip' }), 'Sintra day trip');
    assert.equal(tripName({ location: '   ', title: '' }), 'New Expedition');
    assert.equal(tripName({}), 'New Expedition');
    assert.equal(tripName(null), 'New Expedition');
});

it('starts a trip one day long, on the day', () => {
    assert.deepEqual(tripSeed({ location: 'Lisbon', planned_date: '2026-09-12' }), {
        destination: 'Lisbon', start_date: '2026-09-12', end_date: '2026-09-12', status: 'Planned',
    });
});

it('an undated itinerary starts an undated trip', () => {
    const seed = tripSeed({ location: 'Lisbon', planned_date: null });
    assert.equal(seed.start_date, null);
    assert.equal(seed.end_date, null);
});

/* --- stretching ------------------------------------------------------- */

const trip = { start_date: '2026-09-12', end_date: '2026-09-14' };

it('says nothing when the day is already in the trip', () => {
    assert.equal(stretch(trip, '2026-09-12'), null, 'the first day');
    assert.equal(stretch(trip, '2026-09-13'), null, 'the middle');
    assert.equal(stretch(trip, '2026-09-14'), null, 'the last day');
});

it('widens rather than moves', () => {
    assert.deepEqual(stretch(trip, '2026-09-10'), { start_date: '2026-09-10', end_date: '2026-09-14' });
    assert.deepEqual(stretch(trip, '2026-09-16'), { start_date: '2026-09-12', end_date: '2026-09-16' });
});

it('gives a dateless trip the day', () => {
    assert.deepEqual(stretch({}, '2026-09-12'), { start_date: '2026-09-12', end_date: '2026-09-12' });
});

it('has nothing to say about a day that is not one', () => {
    assert.equal(stretch(trip, null), null);
    assert.equal(stretch(trip, ''), null);
    assert.equal(stretch(trip, 'someday'), null);
});

it('treats a one-day trip with no end as one day', () => {
    const one = { start_date: '2026-09-12', end_date: null };
    assert.equal(stretch(one, '2026-09-12'), null);
    assert.deepEqual(stretch(one, '2026-09-13'), { start_date: '2026-09-12', end_date: '2026-09-13' });
});

it('knows which days a stretch adds, and only those', () => {
    assert.deepEqual(newDates(trip, stretch(trip, '2026-09-16')), ['2026-09-15', '2026-09-16']);
    assert.deepEqual(newDates(trip, stretch(trip, '2026-09-10')), ['2026-09-10', '2026-09-11']);
    assert.deepEqual(newDates(trip, null), []);
});

it('says what stretching would mean before doing it', () => {
    const same = describeStretch(trip, '2026-09-13');
    assert.equal(same.needed, false);
    assert.equal(same.why, null);

    const later = describeStretch(trip, '2026-09-16');
    assert.equal(later.needed, true);
    assert.equal(later.added.length, 2);
    assert.match(later.why, /later than the trip runs/);
    assert.match(later.why, /2 days/);

    const earlier = describeStretch(trip, '2026-09-11');
    assert.match(earlier.why, /earlier than the trip runs/);
    assert.match(earlier.why, /1 day/);

    const blank = describeStretch({}, '2026-09-11');
    assert.match(blank.why, /no dates yet/);
});

console.log(`tripFromPlan: ${n} passed`);
