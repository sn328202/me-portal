/**
 * The drives between stops.
 *
 * The bug this exists to prevent is not a wrong number, it is a *disappearing*
 * one: the old code re-asked Google on every keystroke, got rate-limited, and
 * then wrote the empty result over the answers it already had.
 */

import {
    legKey, legsOf, legsSignature, unanswered, timesFor,
} from '../src/utils/travelLegs.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

const stops = [
    { id: '1', activity: 'Ferry Building', location: 'Ferry Building, SF' },
    { id: '2', activity: 'Che Fico', location: 'Che Fico, SF' },
    { id: '3', activity: 'A walk', location: '' },
    { id: '4', activity: 'Home', location: 'Home, SF' },
];

console.log('\nnaming a drive:');
check('by both ends', legKey('a', 'b'), 'a→b');
check('and not by the item', legKey(' a ', ' b '), 'a→b');

console.log('\nworking out the legs:');
const legs = legsOf(stops);
check('one fewer than the stops', legs.length, 3);
check('each hangs off the stop it leaves', legs.map((l) => l.id), ['1', '2', '3']);
check('the answerable ones have a key', legs.map((l) => Boolean(l.key)), [true, false, false]);
check('and the others say which end is missing', legs.map((l) => l.missing), [null, 'to', 'from']);
check('one stop is no drive at all', legsOf([stops[0]]), []);
check('nor is none', legsOf([]), []);

console.log('\nwhat the lookup depends on:');
check('the addresses in order', legsSignature(stops), 'Ferry Building, SF|Che Fico, SF||Home, SF');
check(
    'renaming a stop changes nothing',
    legsSignature(stops.map((s) => ({ ...s, activity: 'renamed' }))),
    legsSignature(stops)
);
check(
    'moving one does change it',
    legsSignature([stops[1], stops[0], stops[2], stops[3]]) === legsSignature(stops),
    false
);

console.log('\nnot asking twice:');
const cache = { 'Ferry Building, SF→Che Fico, SF': '12 mins' };
check('a known pair is not re-asked', unanswered(legs, cache).length, 0);
check('an unknown one is', unanswered(legsOf([stops[0], stops[1]]), {}).length, 1);
check('an unanswerable one never is', unanswered(legsOf([stops[2], stops[3]]), {}).length, 0);

console.log('\nwhat gets shown:');
check('the drive hangs off the stop it leaves', timesFor(legs, cache), { 1: '12 mins' });
check('nothing known, nothing shown', timesFor(legs, {}), {});
check(
    'a cache that has gone quiet does not blank the rest',
    timesFor(legsOf(stops), { ...cache, 'x→y': '9 mins' }),
    { 1: '12 mins' }
);

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
