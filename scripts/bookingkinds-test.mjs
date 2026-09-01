import assert from 'node:assert/strict';
import { KINDS, kindOf, faceOf, labelOf, guessKind, countBy } from '../src/utils/bookingKinds.js';

let n = 0;
const t = (what, fn) => { fn(); n += 1; console.log(`  ok  ${what}`); };

t('every kind has an id, a label and a face', () => {
    KINDS.forEach((k) => {
        assert.ok(k.id && k.label && k.face, `${k.id} is incomplete`);
    });
    assert.equal(new Set(KINDS.map((k) => k.id)).size, KINDS.length, 'ids are unique');
});

t('a booking with no kind is a table, because all 78 of them were', () => {
    assert.equal(kindOf({}), 'table');
    assert.equal(kindOf({ kind: null }), 'table');
    assert.equal(faceOf({}), '🍽️');
    assert.equal(labelOf({}), 'Table');
});

t('an unknown kind does not blow up the card', () => {
    assert.equal(kindOf({ kind: 'wormhole' }), 'table');
});

t('a real kind is kept', () => {
    assert.equal(kindOf({ kind: 'tasting' }), 'tasting');
    assert.equal(faceOf({ kind: 'show' }), '🎭');
});

t('a guess reads the words she used', () => {
    assert.equal(guessKind('Seavey Vineyard tasting'), 'tasting');
    assert.equal(guessKind('Hamilton — evening show'), 'show');
    assert.equal(guessKind('Caltrain to San Jose'), 'transport');
    assert.equal(guessKind('Two nights at the Ace Hotel'), 'stay');
    assert.equal(guessKind('Stained glass workshop'), 'activity');
    assert.equal(guessKind('Dinner at Che Fico'), 'table');
});

t('a carrier name counts as travel, a training course does not', () => {
    assert.equal(guessKind('Caltrain to San Jose'), 'transport');
    assert.equal(guessKind('Pottery training'), 'other');
});

t('a guess with nothing to go on says so, rather than guessing table', () => {
    // kindOf defaults to a table because every booking that existed was one.
    // A guess is a different claim: "Hamilton at the Orpheum" is not a
    // restaurant, and saying so confidently is worse than shrugging.
    assert.equal(guessKind(''), 'other');
    assert.equal(guessKind(null), 'other');
    assert.equal(guessKind('Bosco'), 'other');
    assert.equal(guessKind('Hamilton at the Orpheum'), 'other');
});

t('the winery beats the dinner when both are said', () => {
    // "Dinner at Seavey Vineyard" is a tasting she is eating at, and the
    // more specific word is the one worth keeping.
    assert.equal(guessKind('Dinner at Seavey Vineyard'), 'tasting');
});

t('counting sorts them into piles', () => {
    const c = countBy([{ kind: 'table' }, {}, { kind: 'show' }, { kind: 'bogus' }]);
    assert.equal(c.table, 3);
    assert.equal(c.show, 1);
    assert.equal(Object.values(c).reduce((a, b) => a + b, 0), 4);
});

t('counting nothing is not a crash', () => {
    assert.deepEqual(countBy(null), {});
});

console.log(`\n${n} passed`);
