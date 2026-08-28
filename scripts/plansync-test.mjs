import assert from 'node:assert/strict';
import { isLinked, syncRows, describeSync } from '../src/utils/planSync.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

it('only a plan that was sent somewhere syncs', () => {
    assert.equal(isLinked({ atlas_day_id: 12 }), true);
    assert.equal(isLinked({ atlas_day_id: null }), false);
    assert.equal(isLinked({}), false);
    assert.equal(isLinked(null), false);
});

const plan = { id: 7, atlas_day_id: 12 };
const items = [
    { activity: 'Dinner at Masque', start_time: '19:00:00', duration: '2 hours', cost: 4000, location: 'Mathuradas Mills' },
    { activity: 'Coffee', start_time: '09:00:00', duration: '45 min' },
    { activity: 'Maybe the museum', is_brainstorm: true },
    { activity: '   ' },
];

it('stamps every row with the plan and the day', () => {
    const rows = syncRows(plan, items, 'u1');
    assert.equal(rows.length, 3, 'the blank one is dropped');
    for (const r of rows) {
        assert.equal(r.day_id, 12);
        assert.equal(r.from_plan_id, 7);
        assert.equal(r.user_id, 'u1');
    }
});

it('keeps the day in the order the itinerary is in', () => {
    const rows = syncRows(plan, items, 'u1');
    assert.deepEqual(rows.map((r) => r.title), ['Coffee', 'Dinner at Masque', 'Maybe the museum']);
    assert.equal(rows[2].start_time, null, 'a maybe carries no time across');
});

it('an emptied itinerary empties its day', () => {
    assert.deepEqual(syncRows(plan, [], 'u1'), []);
    assert.equal(describeSync([]), 'The trip day is now empty too.');
});

it('counts rather than describes', () => {
    assert.equal(describeSync(syncRows(plan, items, 'u1')), '3 things kept in step with the trip.');
    assert.equal(describeSync([{}]), '1 thing kept in step with the trip.');
});

console.log(`planSync: ${n} passed`);
