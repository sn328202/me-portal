import assert from 'node:assert/strict';
import { cityOf, cityFrom } from '../src/utils/placeCity.js';
import { whereRows, unhousedNights, legFromStay, describeNewLeg } from '../src/utils/tripWhere.js';
import { summariseLegs } from '../src/utils/tripLegs.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

console.log('which city a place is in:');

const SF = [
    { long_name: '250', types: ['street_number'] },
    { long_name: 'King Street', types: ['route'] },
    { long_name: 'San Francisco', types: ['locality', 'political'] },
    { long_name: 'California', types: ['administrative_area_level_1'] },
    { long_name: 'United States', types: ['country'] },
];

t('the locality, when there is one', () => {
    assert.equal(cityOf(SF), 'San Francisco');
});

t('and the next best thing when there is not', () => {
    // Out in the Kerala backwaters Google often has no locality at all.
    assert.equal(cityOf([
        { long_name: 'Kottayam', types: ['administrative_area_level_2'] },
        { long_name: 'Kerala', types: ['administrative_area_level_1'] },
        { long_name: 'India', types: ['country'] },
    ]), 'Kottayam');
    assert.equal(cityOf([
        { long_name: 'Kerala', types: ['administrative_area_level_1'] },
    ]), 'Kerala');
});

t('a postal town counts — that is what Google calls a UK city', () => {
    assert.equal(cityOf([{ long_name: 'Bath', types: ['postal_town'] }]), 'Bath');
});

t('nothing readable is empty, not a guess', () => {
    assert.equal(cityOf([]), '');
    assert.equal(cityOf(), '');
    assert.equal(cityOf([{ long_name: 'United States', types: ['country'] }]), '');
});

t('with no components it reads the address, and says so by being last', () => {
    assert.equal(cityFrom({ address: '250 King St, San Francisco, CA 94107, USA' }), 'San Francisco');
    assert.equal(cityFrom({ components: SF, address: 'anything at all' }), 'San Francisco');
});

t('but it does not invent one out of a short address', () => {
    assert.equal(cityFrom({ address: 'Somewhere' }), '');
    assert.equal(cityFrom({}), '');
    assert.equal(cityFrom(), '');
});

console.log('\none list, not two:');

const LEGS = [
    { id: 1, city: 'Air Travel', start_date: '2026-12-23', end_date: '2026-12-25' },
    { id: 2, city: 'Mumbai', start_date: '2026-12-25', end_date: '2026-12-27' },
    { id: 3, city: 'Kerala', start_date: '2026-12-27', end_date: '2027-01-02' },
];
const STAYS = [
    { id: 'a', name: 'Taj', check_in: '2026-12-25', check_out: '2026-12-27' },
    { id: 'b', name: 'Backwater place', check_in: '2026-12-28', check_out: '2026-12-30' },
    { id: 'c', name: 'Booked ahead', check_in: '2027-02-01', check_out: '2027-02-04' },
];

const { rows, orphans } = whereRows(summariseLegs(LEGS, { stays: STAYS }), STAYS);

t('a stretch carries what is booked for it', () => {
    assert.deepEqual(rows.map((r) => r.leg.city), ['Air Travel', 'Mumbai', 'Kerala']);
    assert.deepEqual(rows[1].lodging.map((s) => s.name), ['Taj']);
    assert.deepEqual(rows[2].lodging.map((s) => s.name), ['Backwater place']);
});

t('a flight is not asked where it is sleeping', () => {
    // The question that made the loose-ends panel cry wolf on a red-eye.
    assert.equal(rows[0].travel, true);
    assert.equal(rows[0].wantsBed, false);
    assert.equal(rows[1].wantsBed, true);
});

t('and it says which nights are still open', () => {
    assert.deepEqual(unhousedNights(rows[1]), []);
    assert.deepEqual(unhousedNights(rows[2]), ['2026-12-27', '2026-12-30', '2026-12-31', '2027-01-01']);
    assert.deepEqual(unhousedNights(rows[0]), []);
});

t('a booking no city covers is not dropped on the floor', () => {
    // It is the most interesting row on the page: she has booked somewhere
    // she has not yet said she is going.
    assert.deepEqual(orphans.map((s) => s.name), ['Booked ahead']);
});

console.log('\nlodging fills in the days:');

t('a booking implies the city and the days it covers', () => {
    const leg = legFromStay(STAYS[2], 'Lisbon', LEGS);
    assert.deepEqual(leg, { city: 'Lisbon', start_date: '2027-02-01', end_date: '2027-02-04' });
});

t('but not when she has already said she is going there', () => {
    // The point is to save typing a city, not to add a second copy of one.
    assert.equal(legFromStay(STAYS[0], 'Mumbai', LEGS), null);
});

t('and not from half a booking', () => {
    assert.equal(legFromStay({ check_in: '2027-02-01' }, 'Lisbon', LEGS), null);
    assert.equal(legFromStay(STAYS[2], '  ', LEGS), null);
    assert.equal(legFromStay({ check_in: '2027-02-04', check_out: '2027-02-04' }, 'Lisbon', LEGS), null);
    assert.equal(legFromStay(undefined, 'Lisbon', LEGS), null);
});

t('it says what it is about to do before doing it', () => {
    assert.match(describeNewLeg({ city: 'Lisbon', start_date: '2027-02-01', end_date: '2027-02-04' }),
        /adds Lisbon to your route, 2027-02-01 to 2027-02-04/);
    assert.equal(describeNewLeg(null), '');
});

console.log(`\ntripWhere: ${n} passed`);
