/**
 * Geography tests. Distance and route ordering are pure maths and cheap to
 * pin; getting them wrong produces a day that criss-crosses the city, which
 * looks like a design failure rather than an arithmetic one.
 */
import { distanceKm, routeOrder, addressParts } from '../api/_place.js';

let failed = 0;
const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
};
const near = (label, actual, expected, tolerance) => {
    const ok = Math.abs(actual - expected) <= tolerance;
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got ${actual} want ~${expected}`}`);
};

const SF = { lat: 37.7749, lng: -122.4194 };
const OAK = { lat: 37.8044, lng: -122.2712 };
const NAPA = { lat: 38.2975, lng: -122.2869 };

console.log('\ndistanceKm():');
near('SF to Oakland is about 13km', distanceKm(SF, OAK), 13.4, 1);
near('SF to Napa is about 60km', distanceKm(SF, NAPA), 59, 3);
check('same point is zero', distanceKm(SF, SF), 0);
check('a missing coordinate is null, not zero', distanceKm(SF, { lat: null, lng: null }), null);

console.log('\nrouteOrder() — a day should not criss-cross:');
{
    // Four stops on a line, handed over shuffled. Any sane route visits them
    // in order along the line.
    const stops = [
        { name: 'c', lat: 37.80, lng: -122.40 },
        { name: 'a', lat: 37.78, lng: -122.40 },
        { name: 'd', lat: 37.81, lng: -122.40 },
        { name: 'b', lat: 37.79, lng: -122.40 },
    ];
    check('walks the line in order', routeOrder(stops).map((s) => s.name), ['d', 'c', 'b', 'a']);
}
{
    const total = (route) => route.slice(1).reduce((sum, s, i) => sum + distanceKm(route[i], s), 0);
    const stops = [
        { name: 'ferry', lat: 37.7955, lng: -122.3937 },
        { name: 'twin peaks', lat: 37.7544, lng: -122.4477 },
        { name: 'ft mason', lat: 37.8060, lng: -122.4310 },
        { name: 'mission', lat: 37.7599, lng: -122.4148 },
    ];
    const before = total(stops);
    const after = total(routeOrder(stops));
    const ok = after <= before;
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} never longer than the order given (${before.toFixed(1)}km -> ${after.toFixed(1)}km)`);
}
{
    const stops = [
        { name: 'known', lat: 37.78, lng: -122.40 },
        { name: 'unlocated' },
        { name: 'also known', lat: 37.79, lng: -122.40 },
    ];
    const order = routeOrder(stops).map((s) => s.name);
    check('a place with no coordinates goes last, never dropped', order.length, 3);
    check('  and it is last', order[2], 'unlocated');
}
check('two stops are left alone', routeOrder([{ name: 'x', lat: 1, lng: 1 }, { name: 'y', lat: 2, lng: 2 }]).map((s) => s.name), ['x', 'y']);
check('an empty day is fine', routeOrder([]), []);

console.log('\naddressParts() — read by type, never by position:');
{
    // "1234 Valencia St, San Francisco, CA 94110, USA" — splitting on commas
    // and taking index 2 gives "CA 94110" as the city, which is the bug this
    // replaces.
    const components = [
        { longText: '1234', types: ['street_number'] },
        { longText: 'Valencia Street', types: ['route'] },
        { longText: 'Mission District', types: ['neighborhood'] },
        { longText: 'San Francisco', types: ['locality'] },
        { longText: 'California', shortText: 'CA', types: ['administrative_area_level_1'] },
        { longText: 'United States', types: ['country'] },
    ];
    const parts = addressParts(components);
    check('city is the locality', parts.city, 'San Francisco');
    check('neighbourhood is the neighborhood', parts.neighborhood, 'Mission District');
    check('region', parts.region, 'California');
}
check('a place with no neighbourhood gives null, not the city',
    addressParts([{ longText: 'Napa', types: ['locality'] }]).neighborhood, null);
check('nothing in, nothing out', addressParts([]).city, null);
check('undefined is survivable', addressParts().city, null);

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
