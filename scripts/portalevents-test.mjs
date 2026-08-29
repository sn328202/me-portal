import assert from 'node:assert/strict';
import { itineraryEvents, tripEvents, within } from '../src/utils/portalEvents.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

/* --- itineraries ------------------------------------------------------ */

const plans = [
    { id: 1, title: 'Napa Day w/ Will', planned_date: '2026-08-30' },
    { id: 2, title: 'Someday', planned_date: null },
    { id: 3, title: 'Filed away', planned_date: '2026-08-30', archived_at: '2026-08-01T00:00:00Z' },
];
const planItems = {
    1: [
        { id: 11, activity: 'Lunette Lunch', start_time: '11:00:00', location: 'Napa' },
        { id: 12, activity: 'Maybe a winery', is_brainstorm: true, start_time: '14:00:00' },
        { id: 13, activity: 'Undecided thing', start_time: null },
        { id: 14, activity: '   ', start_time: '16:00:00' },
    ],
    2: [{ id: 21, activity: 'Nowhere', start_time: '09:00:00' }],
    3: [{ id: 31, activity: 'Old lunch', start_time: '12:00:00' }],
};

it('brings across what is actually scheduled', () => {
    const events = itineraryEvents(plans, planItems);
    assert.deepEqual(events.map((e) => e.title), ['Lunette Lunch']);
});

it('leaves out the maybes, the undecided and the unnamed', () => {
    const titles = itineraryEvents(plans, planItems).map((e) => e.title);
    assert.equal(titles.includes('Maybe a winery'), false, 'brainstorm');
    assert.equal(titles.includes('Undecided thing'), false, 'no time');
    assert.equal(titles.length, 1, 'the blank one too');
});

it('ignores a plan with no date and one that is archived', () => {
    const events = itineraryEvents(plans, planItems);
    assert.equal(events.some((e) => e.title === 'Nowhere'), false);
    assert.equal(events.some((e) => e.title === 'Old lunch'), false);
});

it('names the day it came from', () => {
    assert.equal(itineraryEvents(plans, planItems)[0].source, 'Napa Day w/ Will');
    assert.equal(itineraryEvents(plans, planItems, { source: 'Your days' })[0].source, 'Your days');
});

it('runs an hour by default and carries its place', () => {
    const [e] = itineraryEvents(plans, planItems);
    assert.equal((new Date(e.end) - new Date(e.start)) / 60000, 60);
    assert.equal(e.location, 'Napa');
    assert.equal(e.allDay, false);
});

/* --- trips ------------------------------------------------------------ */

const trips = [
    { id: 7, destination: 'India (Goa / Kerala)', start_date: '2026-12-23', end_date: '2027-01-06' },
    { id: 8, destination: 'One-dayer', start_date: '2026-09-05', end_date: null },
    { id: 9, destination: 'No dates yet', start_date: null, end_date: null },
];
const daysByTrip = { 7: [{ id: 70, date: '2026-12-24', city: 'Panjim' }] };
const itemsByDay = {
    70: [
        { id: 700, title: 'Beach shack lunch', start_time: '13:00:00', end_time: '15:00:00' },
        { id: 701, title: 'Something untimed', start_time: null },
        { id: 702, title: 'Backwards', start_time: '18:00:00', end_time: '17:00:00' },
    ],
};

it('lays the trip across its dates as an all-day banner', () => {
    const banner = tripEvents(trips, daysByTrip, itemsByDay).find((e) => e.id === 'trip-7');
    assert.equal(banner.allDay, true);
    assert.equal(banner.title, 'India (Goa / Kerala)');
    assert.equal(banner.start.slice(0, 10), '2026-12-23');
    // Inclusive last day: ends at the start of the 7th.
    assert.equal(banner.end.slice(0, 10), '2027-01-07');
});

it('treats a trip with no end date as one day', () => {
    const banner = tripEvents(trips, daysByTrip, itemsByDay).find((e) => e.id === 'trip-8');
    assert.equal(banner.start.slice(0, 10), '2026-09-05');
    assert.equal(banner.end.slice(0, 10), '2026-09-06');
});

it('has nothing to say about a trip with no dates', () => {
    assert.equal(tripEvents(trips, daysByTrip, itemsByDay).some((e) => e.id === 'trip-9'), false);
});

it('brings the timed stops and skips the rest', () => {
    const stops = tripEvents(trips, daysByTrip, itemsByDay).filter((e) => !e.allDay);
    assert.deepEqual(stops.map((e) => e.title), ['Beach shack lunch', 'Backwards']);
});

it('uses the end time when there is one', () => {
    const [lunch] = tripEvents(trips, daysByTrip, itemsByDay).filter((e) => e.title === 'Beach shack lunch');
    assert.equal((new Date(lunch.end) - new Date(lunch.start)) / 60000, 120);
});

it('an end before its start is a typo, not a negative event', () => {
    const [back] = tripEvents(trips, daysByTrip, itemsByDay).filter((e) => e.title === 'Backwards');
    assert.equal((new Date(back.end) - new Date(back.start)) / 60000, 60);
});

it('falls back to the day city when a stop has no place', () => {
    const [lunch] = tripEvents(trips, daysByTrip, itemsByDay).filter((e) => e.title === 'Beach shack lunch');
    assert.equal(lunch.location, 'Panjim');
});

/* --- the window ------------------------------------------------------- */

it('keeps only what the agenda is showing', () => {
    const from = Date.UTC(2026, 7, 1);
    const to = Date.UTC(2026, 8, 1);
    const kept = within(itineraryEvents(plans, planItems), from, to);
    assert.equal(kept.length, 1);
    assert.equal(within(itineraryEvents(plans, planItems), Date.UTC(2027, 0, 1), Date.UTC(2027, 1, 1)).length, 0);
});

it('copes with nothing at all', () => {
    assert.deepEqual(itineraryEvents(), []);
    assert.deepEqual(tripEvents(), []);
    assert.deepEqual(within(), []);
});

console.log(`portalEvents: ${n} passed`);

/* --- the zone --------------------------------------------------------- */
{
    const { zonedInstant } = await import('../src/utils/portalEvents.js');
    let m = 0;
    const t = (got, want, why) => { assert.equal(got, want, why); m += 1; };

    // The bug: the API runs on Vercel, which is UTC, so an unzoned
    // "2026-08-30T11:00:00" meant eleven in the morning UTC and a lunch
    // arrived at four.
    t(zonedInstant('2026-08-30', '11:00:00', 'America/Los_Angeles'), '2026-08-30T18:00:00.000Z', 'summer, UTC-7');
    t(zonedInstant('2026-12-24', '11:00:00', 'America/Los_Angeles'), '2026-12-24T19:00:00.000Z', 'winter, UTC-8');
    t(zonedInstant('2026-08-30', '11:00:00', 'Asia/Kolkata'), '2026-08-30T05:30:00.000Z', 'half-hour offset');
    t(zonedInstant('2026-08-30', '11:00:00', 'Europe/London'), '2026-08-30T10:00:00.000Z', 'BST');
    t(zonedInstant('2026-01-15', '11:00:00', 'Europe/London'), '2026-01-15T11:00:00.000Z', 'GMT');

    // Midnight, which is what the all-day trip banner is built from.
    t(zonedInstant('2026-12-23', '00:00:00', 'America/Los_Angeles'), '2026-12-23T08:00:00.000Z', 'local midnight');

    // No zone: treat the stored time as already being UTC, which is what it
    // did before and is the only honest fallback.
    t(zonedInstant('2026-08-30', '11:00:00', null), '2026-08-30T11:00:00.000Z', 'no zone');

    // Same wall clock, read back in the same zone, is the same wall clock.
    const back = new Date(zonedInstant('2026-08-30', '11:00:00', 'America/Los_Angeles'))
        .toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit' });
    t(back, '11:00', 'round-trips');

    console.log(`zonedInstant: ${m} passed`);
}

/* --- no duplicates ---------------------------------------------------- */
{
    const { distinct, tripEvents } = await import('../src/utils/portalEvents.js');
    let m = 0;
    const t = (fn) => { fn(); m += 1; };

    t(() => {
        // A day sent to a trip is in both sources. Skipped on the trip side.
        const days = { 7: [{ id: 70, date: '2026-12-24' }] };
        const items = {
            70: [
                { id: 1, title: 'From the itinerary', start_time: '13:00:00', from_plan_id: 'abc' },
                { id: 2, title: 'Added in the Atlas', start_time: '15:00:00', from_plan_id: null },
            ],
        };
        const trips = [{ id: 7, destination: 'Goa', start_date: '2026-12-24', end_date: '2026-12-24' }];

        const both = tripEvents(trips, days, items, { skipFromPlans: true }).filter((e) => !e.allDay);
        assert.deepEqual(both.map((e) => e.title), ['Added in the Atlas']);

        const alone = tripEvents(trips, days, items, { skipFromPlans: false }).filter((e) => !e.allDay);
        assert.equal(alone.length, 2, 'kept when the itineraries source is off');
    });

    t(() => {
        const list = [
            { title: 'Dinner', start: '2026-08-30T18:00:00.000Z', allDay: false },
            { title: 'dinner', start: '2026-08-30T18:00:00.000Z', allDay: false },
            { title: 'Dinner', start: '2026-08-30T19:00:00.000Z', allDay: false },
            { title: 'Dinner', start: '2026-08-30T18:00:00.000Z', allDay: true },
        ];
        assert.equal(distinct(list).length, 3, 'case-insensitive on title, but a different time or kind is a different thing');
    });

    t(() => {
        const list = [{ title: 'A', start: 'x' }, { title: 'B', start: 'x' }];
        assert.equal(distinct(list)[0].title, 'A', 'first one wins');
        assert.deepEqual(distinct([]), []);
        assert.deepEqual(distinct(), []);
    });

    console.log(`distinct: ${m} passed`);
}
