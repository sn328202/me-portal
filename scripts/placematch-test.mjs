import assert from 'node:assert/strict';
import { words, looksLike, fillFrom } from '../src/utils/placeMatch.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

it('strips the noise a restaurant name carries', () => {
    assert.deepEqual(words('The Bombay Canteen'), ['bombay', 'canteen']);
    assert.deepEqual(words('Café Léon'), ['leon']);
    assert.deepEqual(words("Trishna Restaurant & Bar"), ['trishna']);
    assert.deepEqual(words('Masque, Mathuradas Mills'), ['masque']);
});

it('accepts the same place written differently', () => {
    assert.equal(looksLike('Masque', 'Masque Mumbai', 'Mumbai'), true);
    assert.equal(looksLike('The Bombay Canteen', 'Bombay Canteen'), true);
    assert.equal(looksLike('Trishna', 'Trishna Restaurant'), true);
    assert.equal(looksLike('Café Léon', 'Cafe Leon'), true);
});

it('refuses the city suffix when she never said the city', () => {
    assert.equal(looksLike('Masque', 'Masque Mumbai'), false);
});

it('refuses the near misses, which is the whole point', () => {
    assert.equal(looksLike('Indigo', 'Indigo Deli'), false);
    assert.equal(looksLike('Masque', 'Mosque of the Fisherman'), false);
    assert.equal(looksLike('Bombay Canteen', 'Bombay Vintage'), false);
    assert.equal(looksLike('Trishna', ''), false);
    assert.equal(looksLike('', 'Trishna'), false);
    assert.equal(looksLike('The Bar', 'The Restaurant'), false, 'nothing but noise either side');
});

it('fills gaps and only gaps', () => {
    const held = { address: 'the one she typed', place_id: null, rating: null, phone: '' };
    const patch = fillFrom(held, {
        place_id: 'abc', address: 'what Google says', phone: '+91 22 1234',
        maps_url: 'https://maps', rating: 4.6,
    });
    assert.equal(patch.place_id, 'abc');
    assert.equal(patch.phone, '+91 22 1234');
    assert.equal(patch.maps_url, 'https://maps');
    assert.equal(patch.rating, 4.6);
    assert.equal('address' in patch, false, 'what she typed wins');
});

it('has nothing to say when the place has nothing to give', () => {
    assert.deepEqual(fillFrom({ place_id: null }, {}), {});
    assert.deepEqual(fillFrom({ place_id: null }, { place_id: '' }), {});
});

console.log(`placeMatch: ${n} passed`);
