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
