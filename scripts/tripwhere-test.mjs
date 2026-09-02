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

t('a handover night belongs to the city you arrive in, not the one you left', () => {
    /* The bug the live page showed in five seconds: matching on a leg's
       inclusive dates put the Napa Airbnb under San Francisco as well, because
       both legs claim the 1st. Every booking appeared twice. */
    const legs = [
        { id: 1, city: 'San Francisco', start_date: '2026-10-29', end_date: '2026-11-01' },
        { id: 2, city: 'Napa Valley', start_date: '2026-11-01', end_date: '2026-11-02' },
        { id: 3, city: 'San Francisco', start_date: '2026-11-02', end_date: '2026-11-03' },
    ];
    const booked = [
        { id: 'x', name: '250 King Street', check_in: '2026-10-29', check_out: '2026-11-01' },
        { id: 'y', name: 'Airbnb TBD', check_in: '2026-11-01', check_out: '2026-11-02' },
        { id: 'z', name: '250 King Street again', check_in: '2026-11-02', check_out: '2026-11-03' },
    ];
    const out = whereRows(summariseLegs(legs, { stays: booked }), booked);
    assert.deepEqual(out.rows.map((r) => r.lodging.map((s) => s.name)), [
        ['250 King Street'], ['Airbnb TBD'], ['250 King Street again'],
    ]);
    assert.deepEqual(out.orphans, []);
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


/* --- dates, said rather than boxed ------------------------------------- */
const { rangeLabel } = await import('../src/utils/dateRange.js');

console.log('\ndates as a phrase:');

t('the same month says the month once', () => {
    assert.equal(rangeLabel('2026-09-04', '2026-09-13'), '4 – 13 Sep');
});

t('across months, both are named', () => {
    assert.equal(rangeLabel('2026-10-29', '2026-11-02'), '29 Oct – 2 Nov');
});

t('and the year appears only when the range crosses one', () => {
    // Inside a trip whose own dates are at the top of the page, a year on
    // every row is the same fact wearing a uniform.
    assert.equal(rangeLabel('2026-12-27', '2027-01-02'), '27 Dec 2026 – 2 Jan 2027');
    assert.equal(rangeLabel('2026-12-27', '2026-12-30').includes('2026'), false);
});

t('half a range is still worth saying', () => {
    assert.equal(rangeLabel('2026-09-04', null), 'from 4 Sep');
    assert.equal(rangeLabel(null, '2026-09-13'), 'until 13 Sep');
    assert.equal(rangeLabel(null, null), '');
});

t('and a timestamp is a date with extra on the end', () => {
    assert.equal(rangeLabel('2026-09-04T00:00:00Z', '2026-09-13T12:00:00Z'), '4 – 13 Sep');
    assert.equal(rangeLabel('not a date', '2026-09-13'), 'until 13 Sep');
});

console.log(`\ntripWhere: ${n} passed`);
