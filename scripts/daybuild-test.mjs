import assert from 'node:assert/strict';
import {
    endFrom, durationFrom, showCost, readCost, toStop, toRow, toIdea, ideaRow, boardFor,
} from '../src/utils/dayBuild.js';

let n = 0;
const t = (what, fn) => { fn(); n += 1; console.log(`  ok  ${what}`); };

// ---- length, told two ways ----------------------------------------------

t('an end time is a start plus a length', () => {
    assert.equal(endFrom('09:00:00', '1:30'), '10:30:00');
    assert.equal(endFrom('09:00:00', '2'), '11:00:00');
});

t('a length is the gap between the two', () => {
    assert.equal(durationFrom('09:00:00', '10:30:00'), '1:30');
    assert.equal(durationFrom('11:00:00', '13:00:00'), '2:00');
});

t('dinner that runs past midnight is a plan, not an error', () => {
    assert.equal(endFrom('23:00:00', '2:00'), '01:00:00');
    assert.equal(durationFrom('23:00:00', '01:00:00'), '2:00');
});

t('no length and no end are the same absence', () => {
    assert.equal(endFrom('09:00:00', null), null);
    assert.equal(endFrom(null, '1:00'), null);
    assert.equal(durationFrom('09:00:00', null), null);
    assert.equal(durationFrom('09:00:00', '09:00:00'), null);
});

t('the two directions agree with each other', () => {
    for (const [start, dur] of [['09:00:00', '1:30'], ['07:15:00', '0:45'], ['22:30:00', '3:00']]) {
        assert.equal(durationFrom(start, endFrom(start, dur)), dur, `${start} + ${dur}`);
    }
});

// ---- prices --------------------------------------------------------------

t('a price does not grow decimal places it never had', () => {
    // Postgres hands numeric back as "100.00". Showing that means every blur
    // reads as a change and saves it again.
    assert.equal(showCost('100.00'), '100');
    assert.equal(showCost(30), '30');
    assert.equal(showCost('12.50'), '12.5');
    assert.equal(showCost(null), '');
    assert.equal(showCost(''), '');
});

t('zero is a price and stays one', () => {
    assert.equal(showCost('0.00'), '0');
    assert.equal(readCost('0'), 0);
});

t('a typed price is read back as a number', () => {
    assert.equal(readCost('30'), 30);
    assert.equal(readCost('$30'), 30);
    assert.equal(readCost('  '), null);
    assert.equal(readCost(null), null);
});

// ---- rows in, rows out ---------------------------------------------------

const ROW = {
    id: 'a1', title: 'Lunch at Arquet', start_time: '12:00:00', end_time: '13:30:00',
    location: 'Arquet, SF', link: 'https://maps', notes: 'book ahead', cost: '100.00',
    cost_shared: true, icon: '🥗', travel_note: null, place_id: 'p1', place_data: { rating: 4.5 },
    spot_id: 's1', booked_id: null, kind: 'other', colour: 2, sort_order: 1,
};

t('a row becomes something the editor already knows how to hold', () => {
    const s = toStop(ROW);
    assert.equal(s.activity, 'Lunch at Arquet');
    assert.equal(s.duration, '1:30');
    assert.equal(s.cost, '100');
    assert.equal(s.is_brainstorm, false);
    assert.equal(s.icon, '🥗');
    assert.equal(s.place_data.rating, 4.5);
});

t('and goes back without losing anything', () => {
    const back = toRow(toStop(ROW), { dayId: 'd1', userId: 'u1', order: 3 });
    assert.equal(back.title, 'Lunch at Arquet');
    assert.equal(back.start_time, '12:00:00');
    assert.equal(back.end_time, '13:30:00');
    assert.equal(back.cost, 100);
    assert.equal(back.sort_order, 3);
    assert.equal(back.day_id, 'd1');
    assert.equal(back.spot_id, 's1');
    assert.equal(back.colour, 2);
});

t('an unnamed card is given a name rather than refused', () => {
    // title is NOT NULL, and a blank card while she thinks is a real thing.
    assert.equal(toRow({ activity: '   ' }, {}).title, 'Something');
});

t('empty text becomes absence, not an empty string', () => {
    const r = toRow({ activity: 'x', location: '', link: '   ', notes: '' }, {});
    assert.equal(r.location, null);
    assert.equal(r.link, null);
    assert.equal(r.notes, null);
});

t('split is the default and only an explicit false means each', () => {
    assert.equal(toRow({ activity: 'x' }, {}).cost_shared, true);
    assert.equal(toRow({ activity: 'x', cost_shared: undefined }, {}).cost_shared, true);
    assert.equal(toRow({ activity: 'x', cost_shared: false }, {}).cost_shared, false);
});

// ---- the board -----------------------------------------------------------

t('an idea reads as a brainstorm card', () => {
    const i = toIdea({ id: 'i1', title: 'Trick Dog', area: '20th St', url: 'u', cost: '20', start_time: '21:00:00', trip_id: 5, sort_order: 2 });
    assert.equal(i.activity, 'Trick Dog');
    assert.equal(i.location, '20th St');
    assert.equal(i.cost, '20');
    assert.equal(i.is_brainstorm, true);
    assert.equal(i.start_time, '21:00:00');
});

t('and writes back to the ideas table', () => {
    const r = ideaRow({ activity: 'Trick Dog', location: '20th St', link: 'u', cost: '20' }, { tripId: 5, userId: 'u1', order: 0 });
    assert.equal(r.title, 'Trick Dog');
    assert.equal(r.area, '20th St');
    assert.equal(r.url, 'u');
    assert.equal(r.cost, 20);
    assert.equal(r.trip_id, 5);
    assert.equal(r.kind, 'do');
});

t('a place captured before it belonged anywhere shows on every board', () => {
    const ideas = [
        { id: 1, trip_id: 5 },
        { id: 2, trip_id: null },
        { id: 3, trip_id: 9 },
    ];
    assert.deepEqual(boardFor(ideas, 5).map((i) => i.id), [1, 2]);
    assert.deepEqual(boardFor(ideas, 9).map((i) => i.id), [2, 3]);
    assert.deepEqual(boardFor(ideas, '5').map((i) => i.id), [1, 2], 'a trip id from a URL is a string');
});

t('no ideas is an empty board, not a crash', () => {
    assert.deepEqual(boardFor(null, 5), []);
});


t('an idea keeps its face and its place', () => {
    // Both are things she loses today: the emoji never crossed into the
    // Atlas at all, and "just an idea" threw away the Google place.
    const i = toIdea({ id: 'i1', title: 'Trick Dog', icon: '🍸', place_id: 'p9', place_data: { rating: 4.4 } });
    assert.equal(i.icon, '🍸');
    assert.equal(i.place_id, 'p9');
    assert.equal(i.place_data.rating, 4.4);

    const r = ideaRow(i, { tripId: 5, userId: 'u' });
    assert.equal(r.icon, '🍸');
    assert.equal(r.place_id, 'p9');
    assert.deepEqual(r.place_data, { rating: 4.4 });
});

t('and carries them onto the day when it is promoted', () => {
    const idea = toIdea({ id: 'i1', title: 'Trick Dog', icon: '🍸', place_id: 'p9', place_data: { rating: 4.4 }, cost: '15' });
    const row = toRow({ ...idea, start_time: '21:00:00' }, { dayId: 'd1', userId: 'u', order: 4 });
    assert.equal(row.title, 'Trick Dog');
    assert.equal(row.icon, '🍸');
    assert.equal(row.place_id, 'p9');
    assert.equal(row.cost, 15);
    assert.equal(row.start_time, '21:00:00');
    assert.equal(row.day_id, 'd1');
});


t('a stop knows which of the three it is', () => {
    assert.equal(toStop({ id: 'a', title: 'Walk' }).booking, 'none');
    assert.equal(toStop({ id: 'a', title: 'Bosco', booking: 'todo' }).booking, 'todo');
    assert.equal(toStop({ id: 'a', title: 'Dinner', booking: 'booked' }).booking, 'booked');
});

t('a row from before the third state existed still reads right', () => {
    assert.equal(toStop({ id: 'a', title: 'Dinner', booked: true }).booking, 'booked');
    assert.equal(toStop({ id: 'a', title: 'Walk', booked: false }).booking, 'none');
});

t('a stop that came from the Table Book is booked by definition', () => {
    // It IS a reservation. The pointer settles it whatever the field says.
    const s2 = toStop({ id: 'a', title: 'Che Fico', booking: 'todo', booked_id: 'r1' });
    assert.equal(s2.booking, 'booked');
    assert.equal(toRow(s2, {}).booking, 'booked');
});

t('and the state survives the round trip', () => {
    assert.equal(toRow({ activity: 'x', booking: 'todo' }, {}).booking, 'todo');
    assert.equal(toRow({ activity: 'x' }, {}).booking, 'none');
    // The old boolean is kept in step so nothing reading it goes wrong.
    assert.equal(toRow({ activity: 'x', booking: 'booked' }, {}).booked, true);
});

console.log(`\n${n} passed`);
