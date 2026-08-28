/**
 * The box a trip's place search is confined to.
 *
 * The failure this exists to prevent is a box that does not contain a city
 * the trip actually visits — which is what a circle around the *centre* of
 * Mumbai → Kerala → Goa does to Mumbai.
 */

import { tripRect } from '../src/utils/tripBounds.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

const MUMBAI = { city: 'Mumbai', lat: 18.9582347, lng: 72.8319514 };
const KERALA = { city: 'Kerala', lat: 10.1631526, lng: 76.6412712 };
const GOA = { city: 'Goa', lat: 15.2993265, lng: 74.123996 };
const AIR = { city: 'Air Travel', lat: null, lng: null };

const holds = (box, p) => Boolean(box)
    && p.lat >= box.rect.low.lat && p.lat <= box.rect.high.lat
    && p.lng >= box.rect.low.lng && p.lng <= box.rect.high.lng;

console.log('\nnothing to go on:');
check('no legs, no box', tripRect([]), null);
check('legs with no coordinates, no box', tripRect([AIR, { city: 'x' }]), null);
check('a leg at 0,0 is an unset leg', tripRect([{ lat: 0, lng: 0 }]), null);

console.log('\nthe real trip:');
const trip = tripRect([AIR, MUMBAI, KERALA, GOA, MUMBAI]);
check('Mumbai is inside it', holds(trip, MUMBAI), true);
check('so is Kerala', holds(trip, KERALA), true);
check('and Goa', holds(trip, GOA), true);
check('London is not', holds(trip, { lat: 51.5, lng: -0.12 }), false);
check('nor is Delhi', holds(trip, { lat: 28.6, lng: 77.2 }), false);

console.log('\none city:');
const one = tripRect([MUMBAI]);
check('the city is inside its own box', holds(one, MUMBAI), true);
check('and the box has extent', one.rect.high.lat > one.rect.low.lat, true);
check(
    'about fifty kilometres of it',
    Math.round((one.rect.high.lat - one.rect.low.lat) * 100) / 100,
    0.9
);

console.log('\nthe corners are the right way round:');
check('low is south of high', trip.rect.low.lat < trip.rect.high.lat, true);
check('and west of it', trip.rect.low.lng < trip.rect.high.lng, true);

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
