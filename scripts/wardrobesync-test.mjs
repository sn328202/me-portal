import assert from 'node:assert/strict';
import {
    WARDROBE_KEYS, localKey, decide, plan, readLocal, writeLocal, describeSync, closetSize,
} from '../src/utils/wardrobeSync.js';

let n = 0;
const t = (what, fn) => { fn(); n += 1; console.log(`  ok  ${what}`); };

const OLD = '2026-08-01T00:00:00.000Z';
const MID = '2026-08-15T00:00:00.000Z';
const NEW = '2026-08-29T00:00:00.000Z';

// ---- the rescue ---------------------------------------------------------

t('a browser holding the only copy pushes it', () => {
    assert.equal(decide({ local: [{ id: 1 }], remote: undefined, syncedAt: null }), 'push');
});

t('the rescue happens even for a value that looks empty but exists', () => {
    // An empty closet is still a fact about her wardrobe, and an empty array
    // is not the same as never having synced.
    assert.equal(decide({ local: [], remote: undefined, syncedAt: null }), 'push');
});

t('nothing anywhere is nothing to do', () => {
    assert.equal(decide({ local: undefined, remote: undefined, syncedAt: null }), 'rest');
});

// ---- a second browser ---------------------------------------------------

t('a fresh browser takes what the account has', () => {
    assert.equal(decide({ local: undefined, remote: { value: [1], updated_at: NEW }, syncedAt: null }), 'pull');
});

t('agreeing already is doing nothing', () => {
    assert.equal(decide({ local: [1, 2], remote: { value: [1, 2], updated_at: NEW }, syncedAt: OLD }), 'rest');
});

// ---- the awkward middle -------------------------------------------------

t('a browser that has never agreed with the account defers to it', () => {
    assert.equal(decide({ local: [1], remote: { value: [1, 2], updated_at: OLD }, syncedAt: null }), 'pull');
});

t('an account changed since we last agreed wins', () => {
    assert.equal(decide({ local: [1], remote: { value: [1, 2], updated_at: NEW }, syncedAt: MID }), 'pull');
});

t('work done here since we last agreed goes up', () => {
    assert.equal(decide({ local: [1, 2, 3], remote: { value: [1], updated_at: OLD }, syncedAt: MID }), 'push');
});

t('an unreadable timestamp on the row does not cause a pull', () => {
    // Losing her unsaved work to a malformed date would be an unforgivable
    // way to lose it.
    assert.equal(decide({ local: [1, 2], remote: { value: [1], updated_at: 'not a date' }, syncedAt: MID }), 'push');
});

// ---- the whole set ------------------------------------------------------

t('a first ever sync pushes everything it finds and pulls nothing', () => {
    const out = plan({ locals: { trips: [], closets: { me: [1, 2] }, profiles: [{ id: 'me' }] }, rows: [], syncedAt: null });
    assert.deepEqual(out.push.sort(), ['closets', 'profiles', 'trips']);
    assert.deepEqual(out.pull, []);
});

t('a plan only ever mentions keys the planner actually persists', () => {
    const out = plan({ locals: { trips: [1], nonsense: [1] }, rows: [{ key: 'nonsense', value: [9], updated_at: NEW }], syncedAt: null });
    assert.deepEqual(out.push, ['trips']);
    assert.deepEqual(out.pull, []);
    assert.ok(WARDROBE_KEYS.includes('closets'));
});

// ---- reading and writing a Storage --------------------------------------

const fakeStore = (seed = {}) => {
    const box = { ...seed };
    return {
        box,
        getItem: (k) => (k in box ? box[k] : null),
        setItem: (k, v) => { box[k] = v; },
    };
};

t('reading skips a key that will not parse rather than throwing', () => {
    const s = fakeStore({ [localKey('trips')]: '[1,2]', [localKey('closets')]: '{oh no' });
    const got = readLocal(s);
    assert.deepEqual(got.trips, [1, 2]);
    assert.ok(!('closets' in got), 'a corrupt key reads as absent');
});

t('reading an empty browser gives an empty object, not a crash', () => {
    assert.deepEqual(readLocal(fakeStore()), {});
});

t('writing puts it where the planner looks', () => {
    const s = fakeStore();
    assert.equal(writeLocal(s, 'closets', { me: [1] }), true);
    assert.equal(s.box['op_closets'], '{"me":[1]}');
});

t('a full storage box is reported, not thrown', () => {
    assert.equal(writeLocal({ setItem: () => { throw new Error('QuotaExceeded'); } }, 'trips', []), false);
});

// ---- what she is told ---------------------------------------------------

t('the line says what happened', () => {
    assert.equal(describeSync({ push: ['closets'], pull: [] }, 41), 'Saved 1 thing to your account — 41 items in the closet.');
    assert.equal(describeSync({ push: ['a', 'b'], pull: ['c'] }, 41), 'Saved 2 things to your account and brought 1 down from your account — 41 items in the closet.');
    assert.equal(describeSync({ push: [], pull: [] }), 'Your wardrobe is backed up.');
});

t('the closet is counted across everyone in it', () => {
    assert.equal(closetSize({ me: [1, 2, 3], adeesh: [4] }), 4);
    assert.equal(closetSize(null), 0);
    assert.equal(closetSize({ me: 'not a list' }), 0);
});

console.log(`\n${n} passed`);
