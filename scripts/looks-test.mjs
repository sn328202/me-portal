/**
 * Saved looks — the arithmetic, run out of the file that actually ships.
 *
 * The planner is eighty kilobytes of classic script with no module boundary,
 * so there is nothing to import. Rather than keep a second copy of the logic
 * here — which is the copy that stops matching — the pure block is sliced out
 * of the real HTML between its sentinels and evaluated. If someone moves a
 * function out of that block, or renames a sentinel, this file fails loudly
 * rather than testing thin air.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../public/outfit-planner.html', import.meta.url)), 'utf8');

const OPEN = '/* ==== LOOKS: pure logic';
const CLOSE = '/* ==== /LOOKS pure ==== */';
const from = html.indexOf(OPEN);
const to = html.indexOf(CLOSE);
assert.ok(from > 0 && to > from, 'the pure block is still in the planner, between its sentinels');

const source = html.slice(from, to);
for (const fn of ['warmthTarget', 'itemCovers', 'lookPieces', 'lookDress', 'lookFitsDay', 'bestLookFor', 'lookToOutfit', 'wearsOfLook', 'wornInTrip']) {
    assert.ok(source.includes(`function ${fn}(`), `${fn} lives in the pure block`);
}

// The two constants it closes over, as the planner declares them.
const CATS = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Swimwear'];
const AGNOSTIC_CAT = 'Accessories';
const {
    warmthTarget, itemCovers, lookPieces, lookDress, lookFitsDay, bestLookFor, lookToOutfit,
    wearsOfLook, wornInTrip,
} = new Function('CATS', 'AGNOSTIC_CAT', `${source}
    return { warmthTarget, itemCovers, lookPieces, lookDress, lookFitsDay, bestLookFor, lookToOutfit,
             wearsOfLook, wornInTrip };`)(CATS, AGNOSTIC_CAT);

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

const item = (o) => ({ id: o.id, cat: o.cat, name: o.name, dress: o.dress ?? 2, warmth: o.warmth ?? 3, rain: !!o.rain });

const CLOSET = [
    item({ id: 'tee', cat: 'Tops', name: 'White tee', dress: 1 }),
    item({ id: 'cami', cat: 'Tops', name: 'Silk cami', dress: 4 }),
    item({ id: 'jeans', cat: 'Bottoms', name: 'Blue jeans', dress: 2, warmth: 3 }),
    item({ id: 'trousers', cat: 'Bottoms', name: 'Black trousers', dress: 4, warmth: 3 }),
    item({ id: 'shorts', cat: 'Bottoms', name: 'Linen shorts', dress: 1, warmth: 1 }),
    item({ id: 'mules', cat: 'Shoes', name: 'Heeled mules', dress: 4 }),
    item({ id: 'sambas', cat: 'Shoes', name: 'Sambas', dress: 1 }),
    item({ id: 'hoops', cat: 'Accessories', name: 'Gold hoops', dress: 1 }),
];

const LOOKS = [
    { id: 'dinner', name: 'Nice dinner', created: 10, items: { Tops: 'cami', Bottoms: 'trousers', Shoes: 'mules', Accessories: ['hoops'] } },
    { id: 'airport', name: 'Airport day', created: 20, items: { Tops: 'tee', Bottoms: 'jeans', Shoes: 'sambas' } },
    { id: 'beach', name: 'Beach lunch', created: 30, items: { Tops: 'tee', Bottoms: 'shorts', Shoes: 'sambas' } },
];

const MILD = { tmax: 70, tmin: 60, pp: 0 };
const HOT = { tmax: 88, tmin: 78, pp: 0 };
const FREEZING = { tmax: 30, tmin: 20, pp: 0 };

console.log('what a look is made of:');

t('its pieces, in the order the closet is laid out', () => {
    assert.deepEqual(lookPieces(LOOKS[0], CLOSET).map((i) => i.name),
        ['Silk cami', 'Black trousers', 'Heeled mules', 'Gold hoops']);
});

t('a garment that has left the closet leaves the look one short, not broken', () => {
    // Deleting a jumper should not leave a hole drawn on screen.
    const gone = { id: 'x', name: 'Old', items: { Tops: 'tee', Bottoms: 'nolongerhere' } };
    assert.deepEqual(lookPieces(gone, CLOSET).map((i) => i.id), ['tee']);
    assert.deepEqual(lookPieces(gone, []), []);
    assert.deepEqual(lookPieces(null, CLOSET), []);
});

t('how dressy it is, ignoring the accessories', () => {
    // A cocktail dress with trainers is still a cocktail look — the shoes are
    // the part she would swap.
    assert.equal(lookDress(LOOKS[0], CLOSET), 4);
    assert.equal(lookDress(LOOKS[1], CLOSET), 2);
    assert.equal(lookDress({ id: 'j', items: { Accessories: ['hoops'] } }, CLOSET), 0);
});

console.log('\nwhether it suits a day:');

t('every piece has to work, not just most of them', () => {
    assert.equal(lookFitsDay(LOOKS[1], CLOSET, { dress: 1 }, MILD), true);
    // Sambas are casual; a cocktail evening is not their day.
    assert.equal(lookFitsDay(LOOKS[1], CLOSET, { dress: 4 }, MILD), false);
});

t('and dressing three levels over the top is not "fits" either', () => {
    // The cocktail look on a casual day: allowed to be dressier, not by four.
    assert.equal(lookFitsDay(LOOKS[0], CLOSET, { dress: 1 }, MILD), false);
    assert.equal(lookFitsDay(LOOKS[0], CLOSET, { dress: 4 }, MILD), true);
});

t('weather counts for the things you feel it in', () => {
    // Linen shorts in a freeze. Warmth only gates bottoms and outerwear —
    // nobody packs a tee shirt by temperature.
    assert.equal(warmthTarget(HOT), 1);
    assert.equal(warmthTarget(FREEZING), 5);
    assert.equal(lookFitsDay(LOOKS[2], CLOSET, { dress: 1 }, HOT), true);
    assert.equal(lookFitsDay(LOOKS[2], CLOSET, { dress: 1 }, FREEZING), false);
});

t('an empty look fits nothing', () => {
    assert.equal(lookFitsDay({ id: 'e', items: {} }, CLOSET, { dress: 1 }, MILD), false);
});

console.log('\nwhich one to offer:');

t('the closest to the day, not merely an allowed one', () => {
    // The point of offering by name is that it is right, not that it passes.
    assert.equal(bestLookFor(LOOKS, CLOSET, { dress: 4 }, MILD).id, 'dinner');
    assert.equal(bestLookFor(LOOKS, CLOSET, { dress: 1 }, MILD).id, 'beach');
});

t('a tie goes to the one she made most recently', () => {
    const twins = [
        { id: 'old', name: 'Old', created: 1, items: { Tops: 'tee', Shoes: 'sambas' } },
        { id: 'new', name: 'New', created: 99, items: { Tops: 'tee', Shoes: 'sambas' } },
    ];
    assert.equal(bestLookFor(twins, CLOSET, { dress: 1 }, MILD).id, 'new');
});

t('and nothing fitting is null, not a wrong answer', () => {
    assert.equal(bestLookFor(LOOKS, CLOSET, { dress: 5 }, MILD), null);
    assert.equal(bestLookFor([], CLOSET, { dress: 1 }, MILD), null);
    assert.equal(bestLookFor(undefined, CLOSET, { dress: 1 }, MILD), null);
});

console.log('\nwearing one:');

t('it is a copy, so the trip and the look stop being the same object', () => {
    // Editing what she wore in Kerala must not rewrite the look, and editing
    // the look must not rewrite Kerala.
    const worn = lookToOutfit(LOOKS[0], '2026-12-28', 'newid');
    assert.equal(worn.id, 'newid');
    assert.equal(worn.date, '2026-12-28');
    assert.equal(worn.name, 'Nice dinner');
    assert.equal(worn.fromLook, 'dinner');
    assert.deepEqual(worn.items, LOOKS[0].items);
    assert.notEqual(worn.items.Accessories, LOOKS[0].items.Accessories, 'the accessory array is a new array');
    worn.items.Accessories.push('somethingelse');
    assert.deepEqual(LOOKS[0].items.Accessories, ['hoops'], 'the look is untouched');
});

t('worn with no day, it lands in the ideas pile', () => {
    assert.equal(lookToOutfit(LOOKS[1], '', 'x').date, '');
    assert.equal(lookToOutfit(LOOKS[1], undefined, 'x').date, '');
});

t('an empty accessory list does not become an empty slot', () => {
    const out = lookToOutfit({ id: 'a', name: 'A', items: { Tops: 'tee', Accessories: [] } }, '', 'x');
    assert.deepEqual(Object.keys(out.items), ['Tops']);
});

console.log('\nonce it has been worn:');

const TRIPS = [
    {
        id: 'nyc',
        name: 'NYC!',
        byProfile: {
            me: {
                customOutfits: [
                    { id: 'o1', name: 'Nice dinner', date: '2026-09-05', fromLook: 'dinner', items: {} },
                    { id: 'o2', name: 'Something else', date: '2026-09-06', items: {} },
                ],
            },
            adeesh: { customOutfits: [] },
        },
    },
    {
        id: 'kerala',
        name: 'India',
        byProfile: {
            me: {
                customOutfits: [
                    { id: 'o3', name: 'Nice dinner', date: '2026-12-28', fromLook: 'dinner', items: {} },
                    { id: 'o4', name: 'Airport day', date: '2026-12-23', fromLook: 'airport', items: {} },
                ],
            },
        },
    },
];

t('a look knows everywhere it has been worn, newest first', () => {
    assert.deepEqual(wearsOfLook('dinner', TRIPS, 'me'), [
        { tripId: 'kerala', tripName: 'India', date: '2026-12-28' },
        { tripId: 'nyc', tripName: 'NYC!', date: '2026-09-05' },
    ]);
    assert.deepEqual(wearsOfLook('beach', TRIPS, 'me'), []);
});

t('and it is read off the outfits, not counted into the look', () => {
    /* A tally stored on the look goes wrong the first time she deletes the
       day she wore it, and then the look claims a Tuesday that no longer
       exists. Delete the outfit and the wear goes with it. */
    const trimmed = JSON.parse(JSON.stringify(TRIPS));
    trimmed[1].byProfile.me.customOutfits = trimmed[1].byProfile.me.customOutfits.filter((o) => o.id !== 'o3');
    assert.equal(wearsOfLook('dinner', trimmed, 'me').length, 1);
});

t('one person\u2019s wearing is not another\u2019s', () => {
    assert.deepEqual(wearsOfLook('dinner', TRIPS, 'adeesh'), []);
    assert.deepEqual(wearsOfLook('dinner', TRIPS, 'nobody'), []);
});

t('within one trip it knows which days', () => {
    assert.deepEqual(wornInTrip('dinner', TRIPS[0], 'me'), ['2026-09-05']);
    assert.deepEqual(wornInTrip('airport', TRIPS[1], 'me'), ['2026-12-23']);
    assert.deepEqual(wornInTrip('dinner', TRIPS[1], 'adeesh'), []);
    assert.deepEqual(wornInTrip('dinner', undefined, 'me'), []);
});

t('what is already packed is not suggested again', () => {
    // Offering it a second time is the app forgetting she packed it.
    assert.equal(bestLookFor(LOOKS, CLOSET, { dress: 4 }, MILD).id, 'dinner');
    assert.equal(bestLookFor(LOOKS, CLOSET, { dress: 4 }, MILD, ['dinner']), null);
});

t('it steps down to the next one that fits rather than giving up', () => {
    assert.equal(bestLookFor(LOOKS, CLOSET, { dress: 1 }, MILD).id, 'beach');
    assert.equal(bestLookFor(LOOKS, CLOSET, { dress: 1 }, MILD, ['beach']).id, 'airport');
    assert.equal(bestLookFor(LOOKS, CLOSET, { dress: 1 }, MILD, ['beach', 'airport']), null);
});

t('but skipping is only about suggesting — nothing is taken away', () => {
    // She can still choose it herself: sometimes there is a washing machine.
    assert.equal(lookFitsDay(LOOKS[0], CLOSET, { dress: 4 }, MILD), true);
});

console.log('\nwired into the planner:');

for (const [what, needle] of [
    ['the Looks tab exists', '<div class="tab" data-tab="looks">Looks</div>'],
    ['and has a panel to show', 'id="tab-looks"'],
    ['looks are persisted', 'DB.save("looksAll",looksAll)'],
    ['a trip outfit can be kept', 'function saveOutfitAsLook('],
    ['a saved one can be worn on a day', 'function wearThisLook('],
    ['the suggester asks for hers first', 'const saved=bestLookFor(looks,closet,ev,w,wornHereIds());'],
    ['and an empty day is offered one by name', 'const mine=bestLookFor(looks,closet,ev,w,wornHereIds());'],
    ['the shelf says how often each has been worn', '✓ worn ${wears.length}×'],
    ['and the picker lets her wear one again anyway', 'Wear it again'],
]) {
    t(what, () => assert.ok(html.includes(needle), needle));
}

console.log(`\nlooks: ${n} passed`);
