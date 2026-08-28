import assert from 'node:assert/strict';
import { hasBeen, isArchived, onShelf, shelfCounts, todayLocal } from '../src/utils/planShelf.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

const TODAY = '2026-08-28';

const plans = [
    { id: 1, title: 'Last March', planned_date: '2026-03-14' },
    { id: 2, title: 'Today', planned_date: TODAY },
    { id: 3, title: 'Next week', planned_date: '2026-09-04' },
    { id: 4, title: 'Someday', planned_date: null },
    { id: 5, title: 'Put away', planned_date: '2026-01-02', archived_at: '2026-08-01T10:00:00Z' },
    { id: 6, title: 'Way out', planned_date: '2027-01-01' },
];

it('reads today where she is, not in UTC', () => {
    // 11pm on the 28th in a zone behind UTC is still the 28th, and toISOString
    // would call it the 29th.
    const at = new Date(2026, 7, 28, 23, 30);
    assert.equal(todayLocal(at), '2026-08-28');
});

it('today is not past', () => {
    assert.equal(hasBeen({ planned_date: TODAY }, TODAY), false);
    assert.equal(hasBeen({ planned_date: '2026-08-27' }, TODAY), true);
    assert.equal(hasBeen({ planned_date: '2026-08-29' }, TODAY), false);
});

it('an undated plan is an idea, never overdue', () => {
    assert.equal(hasBeen({ planned_date: null }, TODAY), false);
    assert.equal(hasBeen({ planned_date: '' }, TODAY), false);
    assert.equal(hasBeen({}, TODAY), false);
});

it('knows what has been put away', () => {
    assert.equal(isArchived(plans[4]), true);
    assert.equal(isArchived(plans[0]), false);
    assert.equal(isArchived(null), false);
});

it('upcoming counts up, next thing first, ideas at the end', () => {
    assert.deepEqual(onShelf(plans, 'upcoming', TODAY).map((p) => p.title),
        ['Today', 'Next week', 'Way out', 'Someday']);
});

it('past counts down, most recent first', () => {
    assert.deepEqual(onShelf(plans, 'past', TODAY).map((p) => p.title), ['Last March']);
});

it('archived is archived whatever its date', () => {
    assert.deepEqual(onShelf(plans, 'archived', TODAY).map((p) => p.title), ['Put away']);
});

it('an archived plan is on no other shelf', () => {
    for (const shelf of ['upcoming', 'past']) {
        assert.equal(onShelf(plans, shelf, TODAY).some((p) => p.id === 5), false, shelf);
    }
});

it('all is all of them', () => {
    assert.equal(onShelf(plans, 'all', TODAY).length, plans.length);
});

it('counts what is on each shelf', () => {
    assert.deepEqual(shelfCounts(plans, TODAY), { upcoming: 4, past: 1, archived: 1, all: 6 });
});

it('does not mutate what it is given', () => {
    const before = plans.map((p) => p.id);
    onShelf(plans, 'upcoming', TODAY);
    onShelf(plans, 'all', TODAY);
    assert.deepEqual(plans.map((p) => p.id), before);
});

it('copes with nothing', () => {
    assert.deepEqual(onShelf([], 'upcoming', TODAY), []);
    assert.deepEqual(onShelf(undefined, 'past', TODAY), []);
});

console.log(`planShelf: ${n} passed`);
