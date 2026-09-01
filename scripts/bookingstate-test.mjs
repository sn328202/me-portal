import assert from 'node:assert/strict';
import { STATES, stateOf, nextState, labelOf, needsBooking, stillToBook } from '../src/utils/bookingState.js';

let n = 0;
const t = (what, fn) => { fn(); n += 1; console.log(`  ok  ${what}`); };

t('nothing to book is the default, because most things are', () => {
    assert.equal(stateOf({}), 'none');
    assert.equal(stateOf({ booking: null }), 'none');
});

t('a stop from the Table Book is booked whatever else it says', () => {
    // It IS a booking. Nothing else gets a vote.
    assert.equal(stateOf({ booked_id: 'r1' }), 'booked');
    assert.equal(stateOf({ booked_id: 'r1', booking: 'todo' }), 'booked');
});

t('the boolean this replaced is still read', () => {
    // Rows written before the third state existed must not silently become
    // "nothing to book".
    assert.equal(stateOf({ booked: true }), 'booked');
    assert.equal(stateOf({ booked: false }), 'none');
});

t('a state nobody recognises is not a state', () => {
    assert.equal(stateOf({ booking: 'perhaps' }), 'none');
});

t('the loop goes round in the order things happen', () => {
    assert.equal(nextState('none'), 'todo');
    assert.equal(nextState('todo'), 'booked');
    assert.equal(nextState('booked'), 'none');
    assert.equal(nextState('nonsense'), 'todo');
});

t('every state has a label and they are all different', () => {
    assert.equal(STATES.length, 3);
    assert.equal(new Set(STATES.map((s) => s.label)).size, 3);
    assert.equal(labelOf('todo'), 'to book');
});

t('only one of the three is worth shouting about', () => {
    assert.equal(needsBooking({ booking: 'todo' }), true);
    assert.equal(needsBooking({ booking: 'booked' }), false);
    assert.equal(needsBooking({}), false);
    assert.equal(needsBooking({ booking: 'todo', booked_id: 'r1' }), false, 'a real booking is not a task');
});

t('a day can say how much is left to ring up', () => {
    assert.equal(stillToBook([{ booking: 'todo' }, {}, { booking: 'booked' }, { booking: 'todo' }]), 2);
    assert.equal(stillToBook(null), 0);
});

console.log(`\n${n} passed`);
