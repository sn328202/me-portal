/**
 * The circle a trip's place search is biased to.
 *
 * The numbers matter in one direction only: too small and half the trip falls
 * outside the bias, which is the bug this exists to fix. Too large is merely
 * a weaker preference.
 */

import { tripBounds } from '../src/utils/tripBounds.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};
const near = (name, got, want, slack = 0.5) => {
    if (Math.abs(got - want) <= slack) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${got}\n       want ~${want}`);
};

const MUMBAI = { city: 'Mumbai', lat: 18.9582347, lng: 72.8319514 };
const KERALA = { city: 'Kerala', lat: 10.1631526, lng: 76.6412712 };
const GOA = { city: 'Goa', lat: 15.2993265, lng: 74.123996 };
const AIR = { city: 'Air Travel', lat: null, lng: null };

console.log('\nnothing to go on:');
check('no legs, no circle', tripBounds([]), null);
check('legs with no coordinates, no circle', tripBounds([AIR, { city: 'x' }]), null);

console.log('\none city:');
const one = tripBounds([MUMBAI]);
near('the centre is the city', one.lat, 18.958);
check('and the radius is a city, not a point', one.radiusKm, 20);

console.log('\nthe real trip:');
const all = tripBounds([AIR, MUMBAI, KERALA, GOA, MUMBAI]);
near('the centre sits between them', all.lat, 15.8, 0.6);
near('and so does the longitude', all.lng, 74.1, 0.6);
check('the radius is capped at what Places takes', all.radiusKm, 50);

console.log('\ntwo cities close together:');
const pair = tripBounds([
    { lat: 18.95, lng: 72.83 },
    { lat: 19.05, lng: 72.90 },
]);
check('still at least a city wide', pair.radiusKm, 20);

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
