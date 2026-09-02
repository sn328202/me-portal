import assert from 'node:assert/strict';
import {
    atlasPart, sameAtlasPart, wardrobeState, readTrips,
    wardrobeIdFor, atlasIdFrom, TRIPS_KEY, PROFILES_KEY,
} from '../src/utils/wardrobeLink.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

const storeOf = (obj) => {
    const m = new Map(Object.entries(obj).map(([k, v]) => [k, JSON.stringify(v)]));
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

console.log('which half is whose:');

it('the Atlas owns the plan, not the packing', () => {
    const part = atlasPart({
        id: 'atlas-7', name: 'India', dest: 'Goa', start: '2026-12-25', end: '2026-12-29',
        events: [{ date: '2026-12-25', type: 0 }], weather: { '2026-12-25': { tmax: 31 } },
        geo: { lat: 15.3, lon: 74 },
        byProfile: { me: { packChecked: { socks: true } } },
        weatherFetched: '2026-09-01T00:00:00.000Z',
        fromAtlas: true,
    });
    assert.deepEqual(Object.keys(part).sort(),
        ['dest', 'end', 'events', 'geo', 'name', 'start', 'weather']);
});

it('a trip that has not moved does not look moved', () => {
    const a = { name: 'India', events: [{ date: '1', t: 2 }], weather: { x: { tmax: 1 } } };
    const b = { ...a, byProfile: { me: {} }, weatherFetched: new Date().toISOString() };
    assert.equal(sameAtlasPart(a, b), true, 'her work and a timestamp are not changes');
});

it('but a real change does', () => {
    const a = { name: 'India', events: [], weather: {} };
    assert.equal(sameAtlasPart(a, { ...a, name: 'India (Goa / Kerala)' }), false, 'renamed');
    assert.equal(sameAtlasPart(a, { ...a, events: [{ date: '1' }] }), false, 'a day planned');
    assert.equal(sameAtlasPart(a, { ...a, weather: { d: { tmax: 30 } } }), false, 'weather filled in');
});

it('a day inserted in the middle is one change, not every day changed', () => {
    // The weather map is built by walking the days, so inserting the 26th puts
    // it between the 25th and the 27th in key order. Compared naively that is
    // a different string and therefore a change to the whole trip.
    const before = { weather: { '2026-12-25': { tmax: 31 }, '2026-12-27': { tmax: 30 } } };
    const reordered = { weather: { '2026-12-27': { tmax: 30 }, '2026-12-25': { tmax: 31 } } };
    assert.equal(sameAtlasPart(before, reordered), true);
});

it('undefined and missing are the same absence', () => {
    assert.equal(sameAtlasPart({ name: 'X', geo: undefined }, { name: 'X' }), true);
});

it('nothing at all is not a crash', () => {
    assert.equal(atlasPart(null), null);
    assert.equal(sameAtlasPart(null, null), true);
    assert.equal(sameAtlasPart(null, { name: 'X' }), false);
});

console.log('\nnaming the same trip in both rooms:');

it('an Atlas trip has one name in the Wardrobe', () => {
    assert.equal(wardrobeIdFor(11), 'atlas-11');
    assert.equal(atlasIdFrom('atlas-11'), '11');
});

it('a trip the Wardrobe made itself has no way home', () => {
    assert.equal(atlasIdFrom('t_abc123'), null);
    assert.equal(atlasIdFrom(undefined), null);
});

console.log('\nwhat the Wardrobe has done with it:');

const store = storeOf({
    [PROFILES_KEY]: [{ id: 'p1', name: 'Neha' }, { id: 'p2', name: 'Adeesh' }],
    [TRIPS_KEY]: [{
        id: 'atlas-11',
        events: [{ date: '2026-12-25' }, { date: '2026-12-26' }, { date: '2026-12-27' }],
        weather: { '2026-12-25': {}, '2026-12-26': {} },
        byProfile: {
            p1: {
                dayDone: { '2026-12-25': true, '2026-12-26': true, '2026-12-27': false },
                packChecked: { socks: true, boots: true, hat: false },
                customOutfits: [{ id: 'o1' }],
            },
            p2: { dayDone: {}, packChecked: {}, customOutfits: [] },
        },
    }],
});

it('it says how much of the trip it knows about', () => {
    const s = wardrobeState(store, 11);
    assert.equal(s.present, true);
    assert.equal(s.events, 3);
    assert.equal(s.weatherDays, 2);
});

it('counted per person, because two people packing is two jobs', () => {
    const [neha] = wardrobeState(store, 11).people;
    assert.equal(neha.name, 'Neha');
    assert.equal(neha.dressed, 2, 'a false is not a done day');
    assert.equal(neha.packed, 2);
    assert.equal(neha.outfits, 1);
});

it('and someone who has not started is not a row of zeroes', () => {
    assert.deepEqual(wardrobeState(store, 11).people.map((p) => p.name), ['Neha']);
});

it('a trip never sent across says so plainly', () => {
    assert.deepEqual(wardrobeState(store, 99),
        { present: false, events: 0, weatherDays: 0, people: [] });
});

it('a profile the Wardrobe has forgotten still has a person in it', () => {
    const orphan = storeOf({
        [TRIPS_KEY]: [{ id: 'atlas-1', byProfile: { gone: { packChecked: { a: true } } } }],
    });
    assert.equal(wardrobeState(orphan, 1).people[0].name, 'Someone');
});

console.log('\na storage that will not cooperate:');

it('corrupt is empty, not fatal', () => {
    assert.deepEqual(readTrips({ getItem: () => 'not json' }), []);
    assert.deepEqual(readTrips({ getItem: () => '{"not":"an array"}' }), []);
    assert.deepEqual(readTrips(null), []);
    assert.equal(wardrobeState({ getItem: () => 'not json' }, 1).present, false);
});

it('a null in the list is skipped rather than read', () => {
    assert.deepEqual(readTrips(storeOf({ [TRIPS_KEY]: [null, { id: 'a' }] })), [{ id: 'a' }]);
});

console.log(`\nwardrobeLink: ${n} passed`);
