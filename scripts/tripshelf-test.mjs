import assert from 'node:assert/strict';
import { searchTrips, sortTrips, emptyBecause, SORTS } from '../src/utils/tripShelf.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

const TRIPS = [
    { id: 1, destination: 'New Zealand!', start_date: '2023-12-19', end_date: '2023-12-31', status: 'completed' },
    { id: 2, destination: 'Switzerland & Annécy', start_date: '2024-04-28', end_date: '2024-05-05', status: 'completed' },
    { id: 3, destination: 'Singapore / Thailand / Hong Kong', start_date: '2025-10-01', end_date: '2025-10-14', status: 'planned' },
    { id: 4, destination: 'Will in SF!', start_date: '2026-08-29', end_date: '2026-08-30', status: 'planned' },
    { id: 5, destination: 'NYC! for Rianuj!', start_date: '2026-09-04', end_date: '2026-09-13', status: 'planned' },
    { id: 6, destination: 'India (Goa / Kerala)', start_date: '2026-12-23', end_date: '2027-01-06', status: 'planned' },
    { id: 7, destination: 'Japan, sometime', start_date: null, end_date: null, status: 'dreaming' },
];

const TODAY = '2026-09-02';

console.log('finding one:');

t('by any part of the name', () => {
    assert.deepEqual(searchTrips(TRIPS, 'sf').map((x) => x.id), [4]);
    assert.deepEqual(searchTrips(TRIPS, 'goa').map((x) => x.id), [6]);
});

t('without caring about case or accents', () => {
    // She will type "annecy". The trip is called "Annécy".
    assert.deepEqual(searchTrips(TRIPS, 'annecy').map((x) => x.id), [2]);
    assert.deepEqual(searchTrips(TRIPS, 'ANNÉCY').map((x) => x.id), [2]);
});

t('and by status, because "planned" is a thing you look for', () => {
    assert.equal(searchTrips(TRIPS, 'completed').length, 2);
});

t('an empty box is not a filter', () => {
    assert.equal(searchTrips(TRIPS, '').length, 7);
    assert.equal(searchTrips(TRIPS, '   ').length, 7);
});

console.log('\nputting them in order:');

t('what is coming first, soonest first', () => {
    // Ascending by date puts 2023 at the top and the trip she is packing for
    // at the bottom, which is the least useful end of the list.
    const ids = sortTrips(TRIPS, 'soonest', TODAY).map((x) => x.id);
    assert.deepEqual(ids.slice(0, 2), [5, 6], 'NYC then India');
});

t('then the undated, then the done — most recent of those first', () => {
    const ids = sortTrips(TRIPS, 'soonest', TODAY).map((x) => x.id);
    assert.deepEqual(ids, [5, 6, 7, 4, 3, 2, 1]);
});

t('a trip that started but has not ended is still ahead of you', () => {
    // You are on it. It is not history.
    const mid = [{ id: 'now', destination: 'Here', start_date: '2026-08-30', end_date: '2026-09-05' }];
    assert.deepEqual(sortTrips([...TRIPS, ...mid], 'soonest', TODAY)[0].id, 'now');
});

t('newest first, when she wants the other direction', () => {
    assert.deepEqual(sortTrips(TRIPS, 'date', TODAY).map((x) => x.id), [6, 5, 4, 3, 2, 1, 7]);
});

t('A–Z ignores case', () => {
    const names = sortTrips(TRIPS, 'name', TODAY).map((x) => x.destination);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
});

t('longest first, and a tie breaks on recency', () => {
    assert.deepEqual(sortTrips(TRIPS, 'length', TODAY)[0].id, 6, 'India, 15 days');
    assert.equal(sortTrips(TRIPS, 'length', TODAY).at(-1).id, 7, 'the undated one is not long');
});

t('it never sorts in place', () => {
    const before = TRIPS.map((x) => x.id);
    sortTrips(TRIPS, 'name', TODAY);
    sortTrips(TRIPS, 'length', TODAY);
    assert.deepEqual(TRIPS.map((x) => x.id), before);
});

t('and every offered sort actually does something', () => {
    for (const s of SORTS) assert.equal(sortTrips(TRIPS, s.id, TODAY).length, 7, s.id);
});

console.log('\nnothing found:');

t('says which nothing it is', () => {
    assert.match(emptyBecause({ query: 'zzz', shelf: 'all', total: 7 }), /Nothing matches/);
    assert.match(emptyBecause({ query: '', shelf: 'day', total: 7 }), /this shelf/);
    assert.match(emptyBecause({ query: '', shelf: 'all', total: 0 }), /No expeditions yet/);
});

console.log(`\ntripShelf: ${n} passed`);
