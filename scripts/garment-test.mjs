/**
 * Dictating a closet.
 *
 * The failure that matters here is silent. A garment written with a category
 * the planner does not know is not an error anywhere — it is simply a garment
 * that never appears on any screen, discovered weeks later when she wonders
 * where her boots went.
 */
import assert from 'node:assert/strict';
import {
    CATS, categoryOf, shapeGarment, addGarments, nameKey, describeAdded,
} from '../api/_garment.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

/* ---- the category, which is the one that has to be right ---- */

t('a category the planner knows is kept exactly', () => {
    CATS.forEach((c) => assert.equal(categoryOf(c, 'thing'), c));
});

t('and a nearly-right one is understood', () => {
    // What a model says when it is not reading the enum carefully.
    assert.equal(categoryOf('shirt', ''), 'Tops');
    assert.equal(categoryOf('shoe', ''), 'Shoes');
    assert.equal(categoryOf('jacket', ''), 'Outerwear');
});

t('a missing one is read off the name', () => {
    assert.equal(categoryOf(null, 'white leather sneakers'), 'Shoes');
    assert.equal(categoryOf('', 'navy linen blazer'), 'Outerwear');
    assert.equal(categoryOf(undefined, 'floral wrap dress'), 'Dresses');
    assert.equal(categoryOf('', 'high waisted jeans'), 'Bottoms');
    assert.equal(categoryOf('', 'straw sun hat'), 'Accessories');
    assert.equal(categoryOf('', 'black one piece swimsuit'), 'Swimwear');
});

t('and a garment nothing recognises still lands somewhere findable', () => {
    // A garment in the wrong drawer can be moved. A garment in no drawer is
    // gone, and nothing anywhere reports it.
    assert.ok(CATS.includes(categoryOf('', 'my favourite thing')));
});

t('every category the planner offers is reachable', () => {
    // If the planner grows a category and this list does not, garments the
    // model files under it fall back to Tops and nobody is told.
    assert.deepEqual(CATS, ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Swimwear']);
});

/* ---- the shape the planner reads ---- */

t('a garment comes out in exactly the planner\'s shape', () => {
    const g = shapeGarment({ name: 'brown tank top', category: 'Tops' });
    assert.deepEqual(Object.keys(g).sort(),
        ['cat', 'color', 'dress', 'id', 'img', 'name', 'notes', 'rain', 'style', 'warmth']);
});

t('dressiness and warmth take a word or a number', () => {
    assert.equal(shapeGarment({ name: 'x', category: 'Tops', dress: 'Formal' }).dress, 5);
    assert.equal(shapeGarment({ name: 'x', category: 'Tops', dress: 3 }).dress, 3);
    assert.equal(shapeGarment({ name: 'x', category: 'Tops', warmth: 'Very warm' }).warmth, 5);
    assert.equal(shapeGarment({ name: 'x', category: 'Tops' }).dress, 1, 'casual by default');
    assert.equal(shapeGarment({ name: 'x', category: 'Tops' }).warmth, 3, 'medium by default');
});

t('nonsense for a level falls back rather than storing nonsense', () => {
    assert.equal(shapeGarment({ name: 'x', category: 'Tops', dress: 'very fancy' }).dress, 1);
    assert.equal(shapeGarment({ name: 'x', category: 'Tops', dress: 99 }).dress, 1);
    assert.equal(shapeGarment({ name: 'x', category: 'Tops', warmth: -4 }).warmth, 3);
});

t('an accessory is dressiness-agnostic, as the planner assumes', () => {
    // The planner ignores an accessory's dressiness when building an outfit.
    // Storing a 5 here would be a number nothing reads and everything implies.
    const g = shapeGarment({ name: 'gold hoops', category: 'Accessories', dress: 'Formal' });
    assert.equal(g.dress, 1);
});

t('a garment with no name is not a garment', () => {
    assert.equal(shapeGarment({ name: '   ', category: 'Tops' }), null);
    assert.equal(shapeGarment({}), null);
});

t('two garments never share an id', () => {
    const ids = new Set();
    for (let i = 0; i < 500; i += 1) ids.add(shapeGarment({ name: `x${i}`, category: 'Tops' }).id);
    assert.equal(ids.size, 500);
});

/* ---- putting them away ---- */

const closet = { me: [{ id: 'a', name: 'brown tank top', cat: 'Tops' }], adeesh: [] };

t('garments go into the profile asked for, and no other', () => {
    const out = addGarments(closet, 'me', [{ name: 'white sneakers', category: 'Shoes' }]);
    assert.equal(out.closets.me.length, 2);
    assert.equal(out.closets.adeesh.length, 0);
});

t('and the closet it was given is not disturbed', () => {
    addGarments(closet, 'me', [{ name: 'x', category: 'Tops' }]);
    assert.equal(closet.me.length, 1);
});

t('saying the same garment twice leaves one of it', () => {
    // Dictating a wardrobe is not one sitting. She will do a drawer, stop, and
    // come back over the same ground.
    const out = addGarments(closet, 'me', [
        { name: 'Brown Tank Top', category: 'Tops' },
        { name: 'white sneakers', category: 'Shoes' },
    ]);
    assert.deepEqual(out.duplicates, ['Brown Tank Top']);
    assert.equal(out.added.length, 1);
    assert.equal(out.closets.me.length, 2);
});

t('including twice within one breath', () => {
    const out = addGarments({ me: [] }, 'me', [
        { name: 'black jeans', category: 'Bottoms' },
        { name: 'black  jeans ', category: 'Bottoms' },
    ]);
    assert.equal(out.added.length, 1);
    assert.deepEqual(out.duplicates, ['black  jeans']);
});

t('a profile with nothing in it yet is made, not refused', () => {
    const out = addGarments({}, 'newperson', [{ name: 'a coat', category: 'Outerwear' }]);
    assert.equal(out.closets.newperson.length, 1);
});

t('a closet that is missing or broken does not lose the garments', () => {
    assert.equal(addGarments(null, 'me', [{ name: 'a', category: 'Tops' }]).closets.me.length, 1);
    assert.equal(addGarments('nonsense', 'me', [{ name: 'a', category: 'Tops' }]).closets.me.length, 1);
});

t('nameless entries are reported rather than silently dropped', () => {
    const out = addGarments({ me: [] }, 'me', [{ name: '' }, { name: 'a scarf', category: 'Accessories' }]);
    assert.equal(out.added.length, 1);
    assert.equal(out.rejected.length, 1);
});

t('and it says where things went', () => {
    const out = addGarments({ me: [] }, 'me', [
        { name: 'a', category: 'Tops' }, { name: 'b', category: 'Tops' },
        { name: 'c', category: 'Shoes' },
    ]);
    assert.equal(describeAdded(out.added), '2 to Tops, 1 to Shoes');
});

t('two spellings of one name are one name', () => {
    assert.equal(nameKey('  Black   Jeans '), 'black jeans');
});

console.log(`\ngarment: ${n} passed`);

/* ---- outfits --------------------------------------------------------- */

const { matchGarment, buildLook, addLook } = await import('../api/_garment.js');

const wardrobe = [
    { id: 't1', cat: 'Tops', name: 'white silk shirt' },
    { id: 't2', cat: 'Tops', name: 'brown tank top' },
    { id: 'b1', cat: 'Bottoms', name: 'high waisted black jeans' },
    { id: 'o1', cat: 'Outerwear', name: 'black wool blazer' },
    { id: 's1', cat: 'Shoes', name: 'white leather sneakers' },
];

let m = 0;
const u = (name, fn) => { fn(); m += 1; console.log(`  ok  ${name}`); };

u('a garment is found by the name she actually said', () => {
    // Nobody dictates the full stored name.
    assert.equal(matchGarment(wardrobe, 'black jeans').id, 'b1');
    assert.equal(matchGarment(wardrobe, 'White Silk Shirt').id, 't1');
    assert.equal(matchGarment(wardrobe, 'blazer').id, 'o1');
});

u('but an ambiguous one is not guessed at', () => {
    // "white" is a shirt and a pair of sneakers. Picking one puts the wrong
    // thing in her outfit and says nothing about it.
    assert.equal(matchGarment(wardrobe, 'white'), null);
});

u('and something she does not own is not invented', () => {
    assert.equal(matchGarment(wardrobe, 'red velvet cape'), null);
    assert.equal(matchGarment(wardrobe, ''), null);
});

u('an outfit is one garment per category, keyed by category', () => {
    const { look } = buildLook(wardrobe, {
        name: 'work', pieces: ['white silk shirt', 'black jeans', 'blazer'],
    });
    assert.deepEqual(look.items, { Tops: 't1', Bottoms: 'b1', Outerwear: 'o1' });
    assert.equal(look.name, 'work');
    assert.ok(look.created > 0);
});

u('naming two tops is reported, not silently halved', () => {
    // The planner stores one garment per category. A look that quietly lost
    // half of what she said is worse than one she is told to fix.
    const out = buildLook(wardrobe, {
        name: 'x', pieces: ['white silk shirt', 'brown tank top', 'black jeans'],
    });
    assert.deepEqual(out.clashes, ['brown tank top']);
    assert.deepEqual(out.look.items, { Tops: 't1', Bottoms: 'b1' });
});

u('a piece she does not own is named back to her', () => {
    const out = buildLook(wardrobe, { name: 'x', pieces: ['black jeans', 'red cape'] });
    assert.deepEqual(out.missing, ['red cape']);
    assert.equal(out.used.length, 1);
});

u('an outfit of nothing at all is not a look', () => {
    const out = buildLook(wardrobe, { name: 'x', pieces: ['red cape'] });
    assert.equal(out.look, null);
});

u('an unnamed outfit still gets a name', () => {
    assert.equal(buildLook(wardrobe, { pieces: ['black jeans'] }).look.name, 'Untitled look');
});

u('a look goes on the right profile\'s shelf', () => {
    const { look } = buildLook(wardrobe, { name: 'work', pieces: ['black jeans'] });
    const out = addLook({ me: [], adeesh: [] }, 'me', look);
    assert.equal(out.added, true);
    assert.equal(out.looks.me.length, 1);
    assert.equal(out.looks.adeesh.length, 0);
});

u('and saying the same outfit twice does not make two', () => {
    const { look } = buildLook(wardrobe, { name: 'Work', pieces: ['black jeans'] });
    const out = addLook({ me: [{ id: 'old', name: 'work' }] }, 'me', look);
    assert.equal(out.added, false);
    assert.equal(out.looks.me.length, 1);
});

u('the shelf it was given is not disturbed', () => {
    const shelf = { me: [] };
    const { look } = buildLook(wardrobe, { name: 'w', pieces: ['black jeans'] });
    addLook(shelf, 'me', look);
    assert.equal(shelf.me.length, 0);
});

console.log(`\ngarment outfits: ${m} passed`);
