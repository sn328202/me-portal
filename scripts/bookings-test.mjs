/**
 * One paste box for every booking: sorting the model's answer into types,
 * the row each type writes, which trip day it lands on, and the merged list.
 */
process.env.TZ = 'America/Los_Angeles';

const { cleanAll, cleanStay, cleanTable } = await import('../api/booking-parse.js');
const { rowOf, dayRowsFor, inTrip, summaryOf, dateOf, placedIds } = await import('../src/utils/bookingSave.js');
const { mergeUpcoming, withinTrip } = await import('../src/utils/bookingsList.js');

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

console.log('sorting one email into types');
const { items, dropped } = cleanAll({
    tables: [{ kind: 'table', name: 'Masque', date: '2026-11-02', time: '19:30', party_size: 2 }],
    journeys: [{ mode: 'flight', from_place: 'SFO', to_place: 'JFK', depart_date: '2026-11-01', depart_time: '09:00', arrive_time: '17:35' }],
    gigs: [{ name: 'Eric Prydz', venue: 'Shed A', date: '2026-10-31', time: '20:00' }],
    stays: [
        { name: 'Hotel Emma', city: 'New York', check_in: '2026-11-01', check_out: '2026-11-04', cost: 900 },
        { name: 'Broken', check_in: '2026-11-05', check_out: '2026-11-05' },
    ],
});
check('types in date order', items.map((i) => i.type), ['gig', 'journey', 'stay', 'table']);
check('bad stay counted as dropped', dropped, 1);
check('nothing at all', cleanAll({}).items.length, 0);
check('table needs a date', cleanTable({ name: 'x' }), null);
check('table kind defaults to other', cleanTable({ name: 'x', date: '2026-01-01', kind: 'nope' }).kind, 'other');
check('stay link must be web', cleanStay({ name: 'h', check_in: '2026-01-01', check_out: '2026-01-02', link: 'javascript:x' }).link, null);

console.log('rows');
const stay = items.find((i) => i.type === 'stay');
check('stay row carries the trip only when given', [rowOf(stay).trip_id, rowOf(stay, { tripId: 7 }).trip_id], [null, 7]);
check('stay with no cost is 0', rowOf({ ...stay, cost: null }).cost, 0);
const table = items.find((i) => i.type === 'table');
check('table starts_at is the local time as an instant', rowOf(table).starts_at, '2026-11-03T03:30:00.000Z');
check('journey wall clocks kept', rowOf(items.find((i) => i.type === 'journey')).departs, '2026-11-01T09:00:00');
check('gig wall clock kept', rowOf(items.find((i) => i.type === 'gig')).starts, '2026-10-31T20:00:00');
check('stay summary counts nights', summaryOf(stay), 'Hotel Emma · New York · 3 nights');
check('date of a stay is check-in', dateOf(stay), '2026-11-01');

console.log('landing on a trip');
const days = [{ id: 11, date: '2026-10-31' }, { id: 12, date: '2026-11-01' }, { id: 13, date: '2026-11-02' }];
const gigRows = dayRowsFor('gig', { id: 'g', name: 'Eric Prydz', starts: '2026-10-31T20:00:00' }, days);
check('gig lands on its day', gigRows.rows.map((r) => [r.day_id, r.gig_id]), [[11, 'g']]);
const red = dayRowsFor('journey', { id: 'j', from_place: 'SFO', to_place: 'BOM', departs: '2026-11-01T21:00:00', arrives: '2026-11-03T06:00:00' }, days);
check('long journey spreads, missing day reported', [red.rows.map((r) => r.day_id), red.missing], [[12, 13], ['2026-11-03']]);
const t = dayRowsFor('table', { id: 'r', name: 'Masque', starts_at: '2026-11-03T03:30:00.000Z' }, days);
check('table lands on its local day', t.rows.map((r) => [r.day_id, r.booked_id]), [[13, 'r']]);
check('stays never make day rows', dayRowsFor('stay', {}, days).rows.length, 0);
check('in trip', [inTrip('2026-11-01', { start_date: '2026-10-31', end_date: '2026-11-02' }), inTrip('2026-11-05', { start_date: '2026-10-31', end_date: '2026-11-02' })], [true, false]);
check('placed ids', [...placedIds({ 1: [{ gig_id: 'g' }, { booked_id: 5 }] }).table], ['5']);

console.log('merged list');
const merged = mergeUpcoming({
    reservations: [{ id: 1, name: 'Old', starts_at: '2026-01-01T03:00:00Z', status: 'booked' }],
    journeys: [{ id: 2, from_place: 'SFO', to_place: 'JFK', departs: '2026-11-01T09:00:00', status: 'booked' }],
    gigs: [{ id: 3, name: 'Prydz', starts: '2026-10-31T20:00:00', status: 'booked' }, { id: 4, name: 'Gone', starts: '2026-11-09T20:00:00', status: 'cancelled' }],
    stays: [{ id: 5, name: 'Emma', check_in: '2026-10-15', check_out: '2026-10-20', trip_id: null }],
}, '2026-10-18');
check('past and cancelled dropped, stay current until check-out', merged.map((r) => r.key), ['stay-5', 'gig-3', 'journey-2']);
check('stay with no trip is unplaced', merged[0].placed, null);
const trip = { start_date: '2026-10-19', end_date: '2026-10-31' };
check('within trip: overlapping stay and the gig', withinTrip(merged, trip).map((r) => r.key), ['stay-5', 'gig-3']);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
