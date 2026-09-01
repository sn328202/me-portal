import assert from 'node:assert/strict';
import { spanOf, shapeOf, onShelf, shelfCounts, describeShape } from '../src/utils/tripShape.js';

let n = 0;
const t = (what, fn) => { fn(); n += 1; console.log(`  ok  ${what}`); };

t('a day is one day long', () => {
    assert.equal(spanOf({ start_date: '2026-01-31', end_date: '2026-01-31' }), 1);
    assert.equal(shapeOf({ start_date: '2026-01-31', end_date: '2026-01-31' }), 'day');
});

t('a start with no end is still one day', () => {
    assert.equal(spanOf({ start_date: '2026-01-31', end_date: null }), 1);
    assert.equal(shapeOf({ start_date: '2026-01-31' }), 'day');
});

t('a week is a trip', () => {
    assert.equal(spanOf({ start_date: '2024-04-28', end_date: '2024-05-05' }), 8);
    assert.equal(shapeOf({ start_date: '2024-04-28', end_date: '2024-05-05' }), 'trip');
});

t('two days is already a trip', () => {
    assert.equal(shapeOf({ start_date: '2026-08-29', end_date: '2026-08-30' }), 'trip');
});

t('undated is neither, and says so', () => {
    assert.equal(spanOf({ start_date: null, end_date: null }), 0);
    assert.equal(shapeOf({}), 'someday');
    assert.equal(describeShape({}), 'Not dated yet');
});

t('a half-typed date does not become a trip', () => {
    // The year-0002 bug is fixed at the input, but a bad value already stored
    // should not silently reshape the list.
    assert.equal(spanOf({ start_date: '2026-08' }), 0);
    assert.equal(shapeOf({ start_date: 'nonsense' }), 'someday');
});

t('an end before the start is a typo, not a negative trip', () => {
    assert.equal(spanOf({ start_date: '2026-08-30', end_date: '2026-08-29' }), 1);
});

t('a date crossing a month, and a leap day, count right', () => {
    assert.equal(spanOf({ start_date: '2026-01-30', end_date: '2026-02-02' }), 4);
    assert.equal(spanOf({ start_date: '2024-02-28', end_date: '2024-03-01' }), 3);
});

t('the shelves add up to everything', () => {
    const trips = [
        { start_date: '2026-01-31', end_date: '2026-01-31' },
        { start_date: '2026-02-21', end_date: '2026-02-21' },
        { start_date: '2024-04-28', end_date: '2024-05-05' },
        {},
        {},
    ];
    const c = shelfCounts(trips);
    assert.equal(c.all, 5);
    assert.equal(c.day, 2);
    assert.equal(c.trip, 1);
    assert.equal(c.someday, 2);
    assert.equal(c.day + c.trip + c.someday, c.all);
});

t('a shelf holds what it says', () => {
    const trips = [
        { id: 1, start_date: '2026-01-31', end_date: '2026-01-31' },
        { id: 2, start_date: '2024-04-28', end_date: '2024-05-05' },
        { id: 3 },
    ];
    assert.deepEqual(onShelf(trips, 'day').map((t2) => t2.id), [1]);
    assert.deepEqual(onShelf(trips, 'trip').map((t2) => t2.id), [2]);
    assert.deepEqual(onShelf(trips, 'someday').map((t2) => t2.id), [3]);
    assert.equal(onShelf(trips, 'all').length, 3);
    assert.equal(onShelf(null, 'day').length, 0);
});

t('the line under the name reads like English', () => {
    assert.equal(describeShape({ start_date: '2026-01-31', end_date: '2026-01-31' }), 'One day');
    assert.equal(describeShape({ start_date: '2026-08-29', end_date: '2026-08-30' }), '2 days');
});

console.log(`\n${n} passed`);
