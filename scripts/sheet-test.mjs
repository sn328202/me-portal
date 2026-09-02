/**
 * The spreadsheet export, the import, and the Wardrobe handoff.
 *
 * All three are shape-shifting: one grid in, another out. That is exactly the
 * kind of code that looks right and is off by a column, so the fixtures here
 * are her real trip — five legs, a handover between each, weather from
 * ten-year normals — rather than a tidy invented one.
 */

import {
    hourLabel, dayLabel, runsOf, mealFor, itineraryTab, restaurantsTab,
    thingsToDoTab, sheetPayload, parseHour, parseDayHeader, readSheet,
} from '../src/utils/tripSheet.js';
import {
    eventTypeFor, eventsForDay, wardrobeTrip, sendToWardrobe, anchorCity, TYPE_DRESS,
} from '../src/utils/wardrobeHandoff.js';
import { tripCost } from '../src/utils/tripCosts.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

/* --- her trip, cut down to five days ------------------------------------ */

const legs = [
    { id: 'l1', city: 'Mumbai', start_date: '2026-12-25', end_date: '2026-12-27' },
    { id: 'l2', city: 'Kerala', start_date: '2026-12-27', end_date: '2026-12-29' },
];
const stays = [{ id: 's1', name: 'Taj Mahal Palace', check_in: '2026-12-25', check_out: '2026-12-27', cost: 800, cost_shared: true }];
const days = [
    { id: 'd1', date: '2026-12-25', weather: { high: 88.4, low: 71.2, code: 1, source: 'normal' }, cost_food: 40 },
    { id: 'd2', date: '2026-12-26', weather: { high: 89, low: 72, code: 1, source: 'normal' } },
    { id: 'd3', date: '2026-12-27', weather: null },
    { id: 'd4', date: '2026-12-28', weather: { high: 90, low: 74, code: 3, source: 'forecast' } },
    { id: 'd5', date: '2026-12-29', weather: null },
];
const items = {
    d1: [
        { id: 'i1', title: 'Dinner at Masque', kind: 'food', start_time: '19:30:00', cost: 120, cost_shared: true },
        { id: 'i2', title: 'Visit the Taj', kind: 'todo', start_time: '10:00:00', cost: 0 },
    ],
    d2: [{ id: 'i3', title: 'Shopping in Colaba', kind: 'todo', start_time: null }],
    d3: [{ id: 'i4', title: 'Flight to Kochi', kind: 'transport', start_time: '14:00:00', cost: 90 }],
    d4: [{ id: 'i5', title: 'Day on a houseboat', kind: 'todo', start_time: '09:00:00', cost: 300, cost_shared: true }],
};
const costs = tripCost(days, items, 2, stays);
const data = { days, items, legs, stays, costs, currency: 'USD' };

/* --- the small pieces ---------------------------------------------------- */
console.log('\nlabels and runs:');
check('6am reads as the sheet writes it', hourLabel(6), '6:00 AM');
check('noon is 12 PM, not 0 PM', hourLabel(12), '12:00 PM');
check('midnight is 12 AM', hourLabel(24), '12:00 AM');
check('a day label is built from calendar fields', dayLabel('2026-12-25'), 'Fri Dec 25');
check('a bad date does not crash the export', dayLabel('nonsense'), 'nonsense');

check('a repeated city becomes one run',
    runsOf(['Goa', 'Goa', 'Goa', 'Kerala']), [
        { label: 'Goa', start: 0, span: 3 },
        { label: 'Kerala', start: 3, span: 1 },
    ]);
check('blanks never merge together',
    runsOf(['', '', 'Goa']).map((r) => r.span), [1, 1, 1]);

check('a 7:30pm booking is dinner', mealFor('19:30:00'), 'Dinner');
check('a 9am booking is breakfast', mealFor('09:00:00'), 'Breakfast');
check('no time means no guess', mealFor(null), '');

/* --- the main tab -------------------------------------------------------- */
console.log('\nthe itinerary tab:');
const tab = itineraryTab(data);
const row = (label) => tab.rows.find((r) => r[0] === label);

check('one column per day, plus labels and the three side columns',
    tab.rows[0].length, 1 + 5 + 3);
check('the header names the days', tab.rows[0].slice(1, 6),
    ['Fri Dec 25', 'Sat Dec 26', 'Sun Dec 27', 'Mon Dec 28', 'Tue Dec 29']);
check('the side columns survive', tab.rows[0].slice(6),
    ['Things to Do', 'Food', 'Other']);
check('a travel day names both cities', row('City')[3], 'Mumbai → Kerala');
// The flight out lands on the first day of the trip, which is the shape she
// actually enters: Air Travel up to the 25th, Mumbai from the 25th.
check('the sheet says where a flight is going too',
    itineraryTab({
        ...data,
        legs: [{ id: 'a', city: 'Air Travel', start_date: '2026-12-23', end_date: '2026-12-25' }, ...legs],
    }).rows.find((r) => r[0] === 'City')[1],
    'Air Travel → Mumbai');
check('lodging comes from the stay, not the day', row('Lodging').slice(1, 4),
    ['Taj Mahal Palace', 'Taj Mahal Palace', '']);
check('a ten-year average says so', row('Weather')[1], '88° / 71° (typical)');
check('a real forecast does not', row('Weather')[4], '90° / 74°');
check('a day with no weather is blank, not 0°', row('Weather')[3], '');
check('a timed thing lands on its hour', row('10:00 AM')[1], 'Visit the Taj');
check('an evening booking lands in the evening', row('7:00 PM')[1], 'Dinner at Masque');
check('an untimed thing is not lost', row('Unscheduled')[2], 'Shopping in Colaba');

check('the five cost lines are all there',
    tab.rows.slice(-6).map((r) => r[0]), [
        'Lodging USD Cost: (per person)', 'Food Estimate: (per person)',
        'Excursion(s) Cost: (per person)', 'Transportation Cost: (per person)',
        'Points Cost (per person)', 'Running Total Per Person:',
    ]);
// $800 over two nights, split two ways, is $200 a night each.
check('lodging is already per person per night', row('Lodging USD Cost: (per person)')[1], 200);
// $200 lodging + $40 of food typed on the day + half of a $120 dinner shared
// two ways = $300, then another $200 lodging night.
check('the day rolls up', row('Food Estimate: (per person)')[1], 100);
check('the running total accumulates',
    row('Running Total Per Person:').slice(1, 3), [300, 500]);

const cityMerges = tab.merges.filter((m) => m.row === 1);
check('Mumbai merges across its days', cityMerges[0], { row: 1, col: 1, rows: 1, cols: 2 });
check('the side headers span the three header rows',
    tab.merges.filter((m) => m.rows === 3).length, 3);

/* --- the other tabs ------------------------------------------------------ */
console.log('\nthe tables it can fill:');
const rest = restaurantsTab(data);
check('the restaurant headers are hers', rest.rows[0], [
    'Restaurant', 'Meal', 'Price', 'Cuisine', 'Neighborhood', 'Reservations?', "Neha's Rec", 'Notes']);
check('a food item arrives with its meal worked out', rest.rows[1].slice(0, 3),
    ['Dinner at Masque', 'Dinner', 120]);
check('there is room to keep adding', rest.rows.length, 1 + 1 + 12);

const todo = thingsToDoTab(data);
check('the to-do headers are hers', todo.rows[0], ['Things to Do', 'Location', 'Book?', 'Cost (USD)']);
check('food does not appear twice',
    todo.rows.some((r) => r[0] === 'Dinner at Masque'), false);
check('an excursion carries its cost',
    todo.rows.find((r) => r[0] === 'Day on a houseboat')?.[3], 300);

const payload = sheetPayload({ id: 7, destination: 'India', start_date: '2026-12-25', currency: 'USD' }, data);
check('the same trip always writes the same sheet', payload.key, 'me-portal-trip-7');
check('three tabs', payload.tabs.map((t) => t.name), ['Itinerary', 'Restaurants', 'Things to Do']);

/* --- reading one back in ------------------------------------------------- */
console.log('\nreading an old sheet back:');
check('an afternoon hour parses', parseHour('6:00 PM'), '18:00');
check('noon does not become midnight', parseHour('12:00 PM'), '12:00');
check('midnight does not become noon', parseHour('12:00 AM'), '00:00');
check('a label that is not a time is not one', parseHour('Lodging'), null);

check('an ISO header needs no year', parseDayHeader('2026-12-25'), '2026-12-25');
check('a written header takes the year from the trip',
    parseDayHeader('Sat Dec 16', 2023), '2023-12-16');
check('day-first is read the same way', parseDayHeader('16 Dec', 2023), '2023-12-16');
check('no year, no guess', parseDayHeader('Sat Dec 16'), null);

const oldSheet = [
    ['Date/Time', 'Sat Dec 16', 'Sun Dec 17', 'Things to Do'],
    ['Primary City', 'Flower Mound', 'Airplane', ''],
    ['Lodging', "Mom's", '', ''],
    ['9:00 AM', 'Pack', '', ''],
    ['6:00 PM', 'Dinner with Ma\nCall Dad', 'Landing', ''],
    ['Lodging USD Cost: (per person)', '0', '120', ''],
    ['Food Estimate: (per person)', '35', '20', ''],
];
const read = readSheet(oldSheet, { year: 2023 });
check('two days come back', read.days.map((d) => d.date), ['2023-12-16', '2023-12-17']);
check('"Primary City" is the city row too', read.days[0].city, 'Flower Mound');
check('lodging comes back', read.days[0].lodging, "Mom's");
check('costs come back as numbers', [read.days[1].cost_lodging, read.days[0].cost_food], [120, 35]);
check('the side column is not mistaken for a day', read.days.length, 2);
// The first guess was that a second line meant a second plan. Her real
// Switzerland sheet says otherwise: the second line is a detail — "St. Beatus
// Caves / Lauterbrunnen", "S&J Brunch / 11-1" — so the lines join.
check('a second line is a detail, not a second plan',
    read.items.filter((i) => i.date === '2023-12-16' && i.start_time === '18:00').map((i) => i.title),
    ['Dinner with Ma — Call Dad']);
check('a morning item keeps its hour',
    read.items.find((i) => i.title === 'Pack')?.start_time, '09:00');
check('a sheet with no Date row says so plainly',
    readSheet([['Hello']]).skipped.length > 0, true);
check('what could not be read is reported',
    readSheet([['Date', 'Whenever']], { year: 2023 }).skipped, ['column "Whenever"', 'no day columns could be read']);

/* --- round trip ---------------------------------------------------------- */
console.log('\nout and back again:');
const back = readSheet(tab.rows, { year: 2026 });
check('the export reads back with the same dates',
    back.days.map((d) => d.date),
    ['2026-12-25', '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29']);
check('the cities survive the round trip', back.days[3].city, 'Kerala');
check('the dinner survives with its hour',
    back.items.find((i) => i.title === 'Dinner at Masque')?.start_time, '19:00');
check('the untimed thing stays untimed',
    back.items.find((i) => i.title === 'Shopping in Colaba')?.start_time, null);

// Her India trip runs 23 December to 6 January, and the headers say only
// "Wed Dec 23" and "Tue Jan 5". January is next year or the whole import is a
// year out and looks entirely reasonable.
check('a trip over New Year rolls the year',
    readSheet([['Date', 'Wed Dec 30', 'Fri Jan 1', 'Sat Jan 2']], { year: 2026 })
        .days.map((d) => d.date),
    ['2026-12-30', '2027-01-01', '2027-01-02']);

/* --- the Wardrobe -------------------------------------------------------- */
console.log('\nhanded to the Wardrobe:');
check('a flight is a travel day', eventTypeFor({ title: 'Flight to Kochi', kind: 'transport' }), 7);
check('a houseboat is a beach day', eventTypeFor({ title: 'Day on a houseboat', kind: 'todo' }), 6);
check('dinner out is dinner out', eventTypeFor({ title: 'Dinner at Masque', kind: 'food', start_time: '19:30' }), 2);
check('breakfast is not', eventTypeFor({ title: 'Breakfast', kind: 'food', start_time: '08:00' }), 0);
check('a wedding is the dressiest thing there is',
    TYPE_DRESS[eventTypeFor({ title: 'Sangeet', kind: 'todo' })], 5);

check('an empty day still gets a row',
    eventsForDay({ id: 'd5', date: '2026-12-29' }, [], legs).map((e) => e.name), ['Kerala']);
check('a day you change cities is a travel day',
    eventsForDay({ id: 'd3', date: '2026-12-27' }, [], legs)[0].type, 7);
check('lodging is not something you dress for',
    eventsForDay({ id: 'd1', date: '2026-12-25' },
        [{ title: 'Hotel', kind: 'lodging' }, { title: 'Visit the Taj', kind: 'todo' }], legs)
        .map((e) => e.name), ['Visit the Taj']);

const wt = wardrobeTrip(
    { id: 7, destination: 'India (Goa / Kerala)', start_date: '2026-12-25', end_date: '2026-12-29' },
    { days, items, legs }
);
check('the same trip is the same trip', wt.id, 'atlas-7');
check('it geocodes a city, not the trip title', wt.dest, 'Mumbai');

// Her first leg really is called "Air Travel", and Open-Meteo has never heard
// of it. The leg you spend the most days in is the one worth looking up.
check('a mode of transport is not a destination',
    anchorCity([
        { city: 'Air Travel', start_date: '2026-12-23', end_date: '2026-12-25' },
        { city: 'Kerala', start_date: '2026-12-27', end_date: '2027-01-02' },
        { city: 'Mumbai', start_date: '2026-12-25', end_date: '2026-12-27' },
    ]), 'Kerala');
check('a trip that is all travel gives up rather than guessing',
    anchorCity([{ city: 'Flight', start_date: '2026-12-23', end_date: '2026-12-24' }]), '');

// The point she made: those three days are packing and outfits like any
// others. They must not be dropped, and they must not be called sightseeing.
{
    const withFlight = [
        { id: 'a', city: 'Air Travel', start_date: '2026-12-23', end_date: '2026-12-25' },
        ...legs,
    ];
    const outbound = ['2026-12-23', '2026-12-24'].map(
        (date) => eventsForDay({ id: date, date }, [], withFlight)[0]
    );
    check('the flight out still gets a day each',
        outbound.map((e) => e.name), ['Air Travel → Mumbai', 'Air Travel → Mumbai']);
    check('and every one of them is a travel day',
        outbound.map((e) => e.type), [7, 7]);
    // Not only the hour you land: the whole leg dresses for travelling.
    check('even a dinner mid-flight is a travel day',
        eventsForDay({ id: 'x', date: '2026-12-24' },
            [{ title: 'Airport dinner', kind: 'food', start_time: '19:00' }], withFlight)[0].type,
        7);
}
check('only days with weather get weather', Object.keys(wt.weather),
    ['2026-12-25', '2026-12-26', '2026-12-28']);
check('an average is flagged as one', wt.weather['2026-12-25'].estimated, true);
check('a forecast is not', wt.weather['2026-12-28'].estimated, false);
check('every day gets at least one event',
    [...new Set(wt.events.map((e) => e.date))].length, 5);

// The thing that must never be lost: what she has already done in there.
const store = new Map();
const fake = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
const trip = { id: 7, destination: 'India', start_date: '2026-12-25', end_date: '2026-12-29' };
sendToWardrobe(trip, { days, items, legs }, fake);
const saved = JSON.parse(store.get('op_trips'));
saved[0].byProfile = { me: { packChecked: { socks: true } } };
store.set('op_trips', JSON.stringify(saved));

const again = sendToWardrobe(trip, { days, items, legs }, fake);
const after = JSON.parse(store.get('op_trips'));
check('sending twice does not make two trips', after.length, 1);
// The Atlas rewrites its half whenever the trip moves, so "nothing moved" has
// to be a real answer. A write here would be a no-op to a reader and a storage
// event to the planner, which reloads on one — a flicker mid-drag.
check('sending an unchanged trip writes nothing', again.unchanged, true);
check('and does not claim to have updated anything', again.updated, false);
check('what you ticked in there survives',
    after[0].byProfile, { me: { packChecked: { socks: true } } });

// And a real change does go across, still carrying her work.
const moved = sendToWardrobe(
    { ...trip, destination: 'India (Goa / Kerala)' }, { days, items, legs }, fake
);
const afterMove = JSON.parse(store.get('op_trips'));
check('a changed trip is an update', moved.updated, true);
check('and is not called unchanged', moved.unchanged, false);
check('the change is in the store', afterMove[0].name, 'India (Goa / Kerala)');
check('her work still survives it',
    afterMove[0].byProfile, { me: { packChecked: { socks: true } } });
// The backup restoring an older copy over the top of a fresh one. Watched
// live: the trip page sent fifteen days across, the Wardrobe opened, its
// account backup won, and August came back. The next send has to put the
// Atlas's half right again without touching what she has ticked.
{
    const stale = JSON.parse(store.get('op_trips'));
    stale[0].events = [];
    stale[0].weather = {};
    stale[0].name = 'India';
    stale[0].byProfile = { me: { packChecked: { socks: true }, dayDone: { '2026-12-25': true } } };
    store.set('op_trips', JSON.stringify(stale));

    const repair = sendToWardrobe({ ...trip, destination: 'India' }, { days, items, legs }, fake);
    const fixed = JSON.parse(store.get('op_trips'))[0];
    check('a copy that came back stale is put right', repair.updated, true);
    check('the days are back', fixed.events.length > 0, true);
    check('and the weather with them', Object.keys(fixed.weather).length > 0, true);
    check('while everything she ticked is untouched',
        fixed.byProfile, { me: { packChecked: { socks: true }, dayDone: { '2026-12-25': true } } });
}

check('a full storage is a reason, not a crash',
    sendToWardrobe(trip, { days, items, legs }, {
        getItem: () => '[]', setItem: () => { throw new Error('quota'); },
    }).ok, false);
check('a corrupt store does not lose the send',
    sendToWardrobe(trip, { days, items, legs }, {
        getItem: () => 'not json', setItem: () => {},
    }).ok, true);

/* --- what her real Switzerland sheet turned out to contain --------------- */
console.log('\nthings a real exported sheet does:');
{
    // An activity from 9 to 5 is one merged cell, which reads back as the same
    // text on every hour it covers. One paragliding trip, not nine.
    const merged = [
        ['Date/Time', 'Tue Apr 30'],
        ['City', 'Interlaken'],
        ['9:00 AM', 'Paragliding Interlaken'],
        ['10:00 AM', 'Paragliding Interlaken'],
        ['11:00 AM', 'Paragliding Interlaken'],
        ['12:00 PM', ''],
        ['1:00 PM', 'Paragliding Interlaken'],
    ];
    const out = readSheet(merged, { year: 2024 }).items;
    check('a merged block is one plan, at the hour it starts',
        out.map((i) => `${i.start_time} ${i.title}`),
        ['09:00 Paragliding Interlaken', '13:00 Paragliding Interlaken']);

    // A gap resets it, so the afternoon repeat above is a genuine second entry.
    check('the hour grid is what identifies the itinerary tab',
        readSheet(merged, { year: 2024 }).hours, 5);

    // Her packing tab has a Date row and a Primary City row too, over more
    // days, so day count alone picks the wrong tab.
    const packing = [
        ['Date', 'Sat Dec 16', 'Sun Dec 17', 'Mon Dec 18'],
        ['Primary City', '#REF!', 'Flower Mound', 'Airplane'],
        ['Socks', '1', '1', '1'],
    ];
    const wardrobeTab = readSheet(packing, { year: 2023 });
    check('a packing tab has no hours at all', wardrobeTab.hours, 0);
    check('and so loses to an itinerary with fewer days',
        [wardrobeTab, readSheet(merged, { year: 2024 })]
            .sort((a, b) => b.hours - a.hours)[0].days.length, 1);

    // A formula whose reference broke is not a city.
    check('#REF! does not become a place', wardrobeTab.days[0].city, '');
    check('a real city beside it still does', wardrobeTab.days[1].city, 'Flower Mound');

    // A stray serial formatted as a date lands in 1900.
    check('a 1900 column is a leftover, not a day', parseDayHeader('1900-01-10'), null);
    check('a real ISO date is still fine', parseDayHeader('2024-04-28'), '2024-04-28');
}

/* --- an activity has a length, and it survives the trip ------------------ */
console.log('\nhow long something lasts:');
{
    const withSpan = {
        days: [{ id: 'd1', date: '2026-12-25' }],
        items: {
            d1: [
                { id: 'a', title: 'Day on a houseboat', kind: 'todo', start_time: '09:00:00', end_time: '17:00:00' },
                { id: 'b', title: 'Dinner', kind: 'food', start_time: '19:00:00' },
            ],
        },
        legs: [], stays: [], costs: {},
    };
    const grid = itineraryTab(withSpan).rows;
    const at = (label) => grid.find((r) => r[0] === label)?.[1];

    // The block is drawn on every hour it covers, the way she draws it by hand.
    check('a block fills every hour it covers', at('9:00 AM'), 'Day on a houseboat');
    check('including the last one before it ends', at('4:00 PM'), 'Day on a houseboat');
    check('but not the hour it ends at', at('5:00 PM'), '');
    check('something with no length is one row', at('7:00 PM'), 'Dinner');
    check('and does not bleed into the next', at('8:00 PM'), '');

    const back = readSheet(grid, { year: 2026 });
    check('it comes back as one thing, not eight',
        back.items.map((i) => i.title), ['Day on a houseboat', 'Dinner']);
    check('with the hour it started',
        back.items[0].start_time, '09:00');
    // The run of identical cells is the length; without recording where it
    // ends, a full day and a one-hour coffee read back identically.
    check('and the length it ran for', back.items[0].end_time, '17:00:00');
    check('while a one-hour thing claims no length', back.items[1].end_time, undefined);
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
