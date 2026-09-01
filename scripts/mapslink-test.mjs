import assert from 'node:assert/strict';
import { mapsLink, mapFor, pageFor } from '../src/utils/mapsLink.js';

let n = 0;
const t = (what, fn) => { fn(); n += 1; console.log(`  ok  ${what}`); };

t('a place id is all a map link needs', () => {
    const url = mapsLink('ChIJabc', 'Seavey Vineyard');
    assert.ok(url.includes('query_place_id=ChIJabc'));
    assert.ok(url.includes('Seavey%20Vineyard'));
});

t('no place is no link', () => {
    assert.equal(mapsLink(null, 'Somewhere'), null);
    assert.equal(mapsLink('   ', 'Somewhere'), null);
});

t('a place with no name still maps', () => {
    assert.ok(mapsLink('ChIJabc').includes('query_place_id=ChIJabc'));
});

t('an older idea keeps the map link it already had', () => {
    // Everything from before this stored the map in `url`. It still works.
    const idea = { url: 'https://www.google.com/maps/search/?api=1&query=Peju', title: 'Peju' };
    assert.equal(mapFor(idea), idea.url);
});

t('a place id wins over the stored one', () => {
    const idea = { place_id: 'ChIJnew', url: 'https://www.google.com/maps/search/?api=1&query=old', title: 'Peju' };
    assert.ok(mapFor(idea).includes('ChIJnew'));
});

t('a page she saved is not mistaken for a map', () => {
    const idea = { url: 'https://peju.com/visit', title: 'Peju' };
    assert.equal(mapFor(idea), null, 'a winery site is not a map');
    assert.equal(pageFor(idea), 'https://peju.com/visit');
});

t('and a map is not mistaken for a page she saved', () => {
    assert.equal(pageFor({ url: 'https://www.google.com/maps/search/?api=1&query=x' }), null);
    assert.equal(pageFor({ url: 'https://maps.google.com/?q=x' }), null);
    assert.equal(pageFor({}), null);
});

t('both can be true at once', () => {
    const idea = { place_id: 'ChIJabc', url: 'https://peju.com/visit', title: 'Peju' };
    assert.ok(mapFor(idea).includes('ChIJabc'));
    assert.equal(pageFor(idea), 'https://peju.com/visit');
});

console.log(`\n${n} passed`);
