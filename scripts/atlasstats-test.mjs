import assert from 'node:assert/strict';
import { hasHappened, countriesOf, atlasStats } from '../src/utils/atlasStats.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

const TODAY = '2026-08-28';

it('a trip has happened when its dates say so, not its status', () => {
    assert.equal(hasHappened({ start_date: '2026-01-02', end_date: '2026-01-09' }, TODAY), true);
    assert.equal(hasHappened({ start_date: '2026-12-23', end_date: '2027-01-06' }, TODAY), false);
    assert.equal(hasHappened({ start_date: '2026-08-01', end_date: null, status: 'Dreaming' }, TODAY), true,
        'no end date falls back to the start');
});

it('a trip with no dates has not happened, whatever it says on it', () => {
    assert.equal(hasHappened({ status: 'Completed' }, TODAY), false);
    assert.equal(hasHappened({ start_date: '', end_date: '' }, TODAY), false);
    assert.equal(hasHappened(null, TODAY), false);
});

it('today is not past', () => {
    assert.equal(hasHappened({ start_date: TODAY, end_date: TODAY }, TODAY), false);
});

/* --- countries -------------------------------------------------------- */

const legs = {
    1: [
        { country_code: 'IN', country: 'India' },
        { country_code: 'in', country: 'India' },
        { country_code: 'LK', country: 'Sri Lanka' },
    ],
    2: [{ country_code: 'IN', country: 'India' }, { country_code: 'PT', country: 'Portugal' }],
    3: [{ country: null, country_code: null }],
};

it('counts each country once however it is spelled, in name order', () => {
    const found = countriesOf(legs);
    assert.deepEqual(found.map((c) => c.name), ['India', 'Portugal', 'Sri Lanka']);
    assert.equal(found.length, 3, 'IN appears three times across two trips and counts once');
});

it('carries a flag for each', () => {
    for (const c of countriesOf(legs)) assert.ok(c.flag, c.code);
});

it('ignores a leg that does not know where it is', () => {
    assert.deepEqual(countriesOf({ 1: [{}, { country_code: '' }, { country_code: 'XXX' }] }), []);
    assert.deepEqual(countriesOf({}), []);
});

/* --- the shelf -------------------------------------------------------- */

const trips = [
    { id: 1, start_date: '2026-01-02', end_date: '2026-01-09', party_size: 2 },
    { id: 2, start_date: '2026-12-23', end_date: '2027-01-06', party_size: 2 },
    { id: 3, start_date: null, end_date: null },
    { id: 4, start_date: '2026-03-01', end_date: '2026-03-05' },
];

it('splits been from ahead', () => {
    const s = atlasStats({ trips, legsByTrip: legs, costByTrip: {}, today: TODAY });
    assert.equal(s.trips, 4);
    assert.equal(s.been, 2);
    assert.equal(s.ahead, 2, 'the undated one has not happened');
});

it('averages over the priced trips, not over all of them', () => {
    const s = atlasStats({ trips, legsByTrip: legs, costByTrip: { 1: 1200 }, today: TODAY });
    assert.equal(s.spend, 1200);
    assert.equal(s.priced, 1);
    assert.equal(s.average, 1200, 'three empty ideas do not quarter the one real number');
});

it('averages properly once more than one is priced', () => {
    const s = atlasStats({ trips, legsByTrip: legs, costByTrip: { 1: 1000, 2: 3000 }, today: TODAY });
    assert.equal(s.spend, 4000);
    assert.equal(s.average, 2000);
    assert.equal(s.dearest.trip.id, 2);
});

it('has no answer rather than a zero when nothing is priced', () => {
    const s = atlasStats({ trips, legsByTrip: legs, costByTrip: {}, today: TODAY });
    assert.equal(s.spend, 0);
    assert.equal(s.average, 0);
    assert.equal(s.dearest, null);
});

it('counts the countries across every trip', () => {
    const s = atlasStats({ trips, legsByTrip: legs, costByTrip: {}, today: TODAY });
    assert.equal(s.countries.length, 3);
});

it('copes with an empty Atlas', () => {
    const s = atlasStats({ trips: [], legsByTrip: {}, costByTrip: {}, today: TODAY });
    assert.deepEqual([s.trips, s.been, s.ahead, s.spend, s.average], [0, 0, 0, 0, 0]);
    assert.deepEqual(s.countries, []);
    assert.equal(s.dearest, null);
});

console.log(`atlasStats: ${n} passed`);
