/**
 * Ingredient matching tests.
 *
 * The pantry fixture below is a slice of the real one — including its warts,
 * because the warts are what breaks matchers: `cilantro`, `tomato`, `potato`
 * and `heavy cream` each exist twice under different categories, `shallot` and
 * `shallots` are separate rows, and the spices are named in a mixture of
 * English and Hindi.
 *
 * A matcher that only passes against a tidy pantry is not the matcher this app
 * needs.
 */
import {
    normalise, singular, buildMatcher, guessCategory, labelFor,
} from '../src/utils/ingredientMatch.js';

let failed = 0;
const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got  ${JSON.stringify(actual)}\n         want ${JSON.stringify(expected)}`}`);
};

const PANTRY = [
    // Spices — the Hindi-named half of the real pantry
    { name: 'bay leaf', label: 'bay leaf', category: 'Spices', in_stock: true },
    { name: 'red chilli powder', label: 'red chilli powder', category: 'Spices', in_stock: true },
    { name: 'kashmiri red chilli powder', label: 'kashmiri red chilli powder', category: 'Spices', in_stock: false },
    { name: 'cumin powder', label: 'cumin powder', category: 'Spices', in_stock: true },
    { name: 'cumin seeds', label: 'cumin seeds', category: 'Spices', in_stock: true },
    { name: 'coriander powder', label: 'coriander powder', category: 'Spices', in_stock: true },
    { name: 'black pepper', label: 'black pepper', category: 'Spices', in_stock: true },
    { name: 'black peppercorns', label: 'black peppercorns', category: 'Spices', in_stock: true },
    { name: 'white pepper powder', label: 'White Pepper Powder', category: 'Spices', in_stock: true },
    { name: 'garam masala', label: 'garam masala', category: 'Spices', in_stock: true },
    { name: 'kasuri methi', label: 'kasuri methi', category: 'Spices', in_stock: true },
    { name: 'amchur', label: 'amchur', category: 'Spices', in_stock: true },
    { name: 'hing', label: 'hing', category: 'Spices', in_stock: true },
    { name: 'turmeric', label: 'turmeric', category: 'Spices', in_stock: true },
    { name: 'dried red chillies', label: 'dried red chillies', category: 'Spices', in_stock: true },
    { name: 'salt', label: 'salt', category: 'Spices', in_stock: true },
    { name: 'flaky sea salt', label: 'flaky sea salt', category: 'Spices', in_stock: true },
    // Produce — note the duplicate cilantro and the singular/plural split
    { name: 'cilantro', label: 'cilantro', category: 'Produce', in_stock: false },
    { name: 'green chilli', label: 'green chilli', category: 'Produce', in_stock: true },
    { name: 'curry leaves', label: 'curry leaves', category: 'Produce', in_stock: true },
    { name: 'garlic', label: 'Garlic', category: 'Produce', in_stock: true },
    { name: 'ginger', label: 'ginger', category: 'Produce', in_stock: true },
    { name: 'spring onion', label: 'spring onion', category: 'Produce', in_stock: false },
    { name: 'shallot', label: 'shallot', category: 'Produce', in_stock: false },
    { name: 'mushrooms', label: 'mushrooms', category: 'Produce', in_stock: false },
    { name: 'tomato', label: 'Tomato', category: 'Produce', in_stock: false },
    { name: 'lemon', label: 'lemon', category: 'Produce', in_stock: true },
    // Pantry — the second cilantro, in stock, filed elsewhere
    { name: 'cilantro', label: 'cilantro', category: 'Pantry', in_stock: true },
    { name: 'olive oil', label: 'olive oil', category: 'Pantry', in_stock: true },
    { name: 'sesame oil', label: 'Sesame oil', category: 'Pantry', in_stock: true },
    { name: 'soy sauce', label: 'Soy Sauce', category: 'Pantry', in_stock: true },
    { name: 'shaoxing wine', label: 'Shaoxing wine', category: 'Pantry', in_stock: true },
    { name: 'dried shiitake mushrooms', label: 'dried shiitake mushrooms', category: 'Pantry', in_stock: true },
    { name: 'flour', label: 'Flour', category: 'Pantry', in_stock: true },
    { name: "confectioner's sugar", label: "confectioner's sugar", category: 'Pantry', in_stock: true },
    { name: 'sugar', label: 'Sugar', category: 'Pantry', in_stock: true },
    { name: 'coconut milk', label: 'coconut milk', category: 'Pantry', in_stock: true },
    { name: 'heavy cream', label: 'heavy cream', category: 'Pantry', in_stock: true },
    { name: 'onions', label: 'onions', category: 'Pantry', in_stock: true },
    { name: 'chicken broth', label: 'chicken broth', category: 'Pantry', in_stock: false },
    // Protein
    { name: 'chicken', label: 'Chicken', category: 'Protein', in_stock: false },
    { name: 'egg', label: 'Eggs', category: 'Protein', in_stock: true },
    { name: 'ground pork', label: 'ground pork', category: 'Protein', in_stock: false },
    { name: 'tofu', label: 'tofu', category: 'Protein', in_stock: true },
];

const m = buildMatcher(PANTRY);
const to = (line) => {
    const r = m.matchOne(line);
    return r.item ? `${r.item.name}:${r.confidence}` : `none:${r.confidence}`;
};

console.log('\nsingular():');
check('leaves -> leaf', singular('leaves'), 'leaf');
check('chillies -> chilli', singular('chillies'), 'chilli');
check('tomatoes -> tomato', singular('tomatoes'), 'tomato');
check('onions -> onion', singular('onions'), 'onion');
check('hummus is not a plural', singular('hummus'), 'hummus');
check('molasses is a mass noun, not a plural', singular('molasses'), 'molasses');
check('  but glasses really is one', singular('glasses'), 'glass');
check('peas -> pea', singular('peas'), 'pea');

console.log('\nnormalise() — the two lines Neha named:');
check('"1 bay leaf"', normalise('1 bay leaf').text, 'bay leaf');
check('"include a bay leaf"', normalise('include a bay leaf').text, 'bay leaf');
check('"get deggi mirch indian chilli powder"',
    normalise('get deggi mirch indian chilli powder').text, 'red chilli powder');

console.log('\nnormalise() — the shapes recipes actually use:');
check('quantity and unit go', normalise('2 tbsp olive oil').text, 'olive oil');
check('fraction quantity goes', normalise('1 1/2 cups flour').text, 'flour');
check('parenthetical note goes', normalise('1 onion (finely chopped)').text, 'onion');
check('post-comma note goes', normalise('2 tomatoes, diced').text, 'tomato');
check('prep words go', normalise('3 cloves garlic, finely minced').text, 'garlic');
check('"to taste" goes', normalise('salt to taste').text, 'salt');
check('"for serving" goes', normalise('cilantro, for serving').text, 'cilantro');
check('plural becomes singular', normalise('curry leaves').text, 'curry leaf');
check('colour is kept — it is the ingredient',
    normalise('1 tsp red chilli powder').text, 'red chilli powder');
check('"ground" is kept — ground pork is not pork',
    normalise('200g ground pork').text, 'ground pork');
check('"dried" is kept — dried chillies are not chillies',
    normalise('4 dried red chillies').text, 'dried red chilli');
check('"freshly" goes but "ground" stays',
    normalise('freshly ground black pepper').text, 'ground black pepper');
check('hyphens flatten', normalise('half-and-half').text, 'half and half');
// The pantry row reduces to the same thing, which is all that matters.
check('apostrophes go', normalise("confectioner's sugar").text, 'confectioner sugar');
check('  and icing sugar lands on it', normalise('icing sugar').text, 'confectioner sugar');
check('spelling variants collapse', normalise('2 red chiles').text, 'red chilli');
check('an empty line stays empty', normalise('   ').text, '');

console.log('\nnormalise() — synonyms:');
check('haldi -> turmeric', normalise('1 tsp haldi').text, 'turmeric');
check('ground cumin -> cumin powder', normalise('ground cumin').text, 'cumin powder');
check('asafoetida -> hing', normalise('a pinch of asafoetida').text, 'hing');
check('scallions -> spring onion', normalise('3 scallions').text, 'spring onion');
check('all purpose flour -> flour', normalise('2 cups all-purpose flour').text, 'flour');
check('chinese cooking wine -> shaoxing', normalise('1 tbsp chinese cooking wine').text, 'shaoxing wine');
check('dried fenugreek leaves -> kasuri methi',
    normalise('1 tsp dried fenugreek leaves').text, 'kasuri methi');

console.log('\nmatchOne() — exact:');
check('"1 bay leaf"', to('1 bay leaf'), 'bay leaf:exact');
check('"include a bay leaf"', to('include a bay leaf'), 'bay leaf:exact');
check('"2 dried bay leaves"', to('2 dried bay leaves'), 'bay leaf:strong');
check('"3 cloves garlic, minced"', to('3 cloves garlic, minced'), 'garlic:exact');
check('plural pantry row still matches', to('1 large onion'), 'onions:exact');
check('curry leaves', to('10 curry leaves'), 'curry leaves:exact');

console.log('\nmatchOne() — the chilli powder case:');
check('"get deggi mirch indian chilli powder"',
    to('get deggi mirch indian chilli powder'), 'red chilli powder:exact');
// 'likely' rather than 'strong': the line is *less* specific than the pantry
// row, so the app is genuinely guessing which chilli powder she means. It
// still counts, and the UI shows what it picked.
check('"1 tsp chilli powder" finds the stocked one',
    to('1 tsp chilli powder'), 'red chilli powder:likely');
check('kashmiri is specific enough to win',
    to('2 tsp kashmiri red chilli powder'), 'kashmiri red chilli powder:exact');
check('a shared "powder" alone is NOT a match',
    to('4 tbsp custard powder'), 'none:none');
check('a shared "sauce" alone is NOT a match',
    to('2 tbsp worcestershire sauce'), 'none:none');

console.log('\nmatchOne() — head-noun matching:');
check('"freshly ground black pepper"', to('freshly ground black pepper'), 'black pepper:strong');
check('"toasted sesame oil"', to('1 tsp toasted sesame oil'), 'sesame oil:exact');
check('"shiitake mushrooms"', to('50g dried shiitake mushrooms'), 'dried shiitake mushrooms:exact');
check('"good quality olive oil"', to('3 tbsp good quality olive oil'), 'olive oil:exact');
check('"full-fat coconut milk"', to('1 can full-fat coconut milk'), 'coconut milk:strong');

console.log('\nmatchOne() — the duplicate-row problem:');
{
    const r = m.matchOne('a handful of cilantro');
    check('cilantro is filed twice; the stocked copy wins',
        `${r.item?.name}:${r.item?.in_stock}`, 'cilantro:true');
}

console.log('\nmatchOne() — things genuinely not in the pantry:');
check('gochujang', to('2 tbsp gochujang'), 'none:none');
check('miso paste', to('1 tbsp white miso paste'), 'none:none');
check('nothing at all', to(''), 'none:none');

console.log('\nmatchRecipe():');
{
    const result = m.matchRecipe([
        { item: '1 bay leaf' },
        { item: 'get deggi mirch indian chilli powder' },
        { item: '2 tbsp gochujang' },
        { item: '1 lb chicken thighs' },
        { item: 'salt to taste' },
    ]);
    check('five lines in, five out', result.total, 5);
    check('three are stocked', result.lines.filter((l) => l.inStock).length, 3);
    check('  bay leaf, chilli powder, salt', result.percent, 60);
    check('one is unknown to the pantry', result.missing.map((l) => l.raw), ['2 tbsp gochujang']);
    check('one is known but out of stock', result.outOfStock.map((l) => l.match.name), ['chicken']);
    check('a line that says what it matched needs no note',
        result.lines[0].resolvedAs, null);
    check('  even when the line was messy around it',
        result.lines[4].resolvedAs, null);
    check('a line that does not gets one',
        result.lines[1].resolvedAs, 'red chilli powder');
    // "chicken thighs" says "chicken" out loud, so nothing needs explaining.
    check('  but a line containing the name does not', result.lines[3].resolvedAs, null);
}

console.log('\nguessCategory() / labelFor() — for bulk add:');
check('gochujang lands in Pantry', guessCategory('2 tbsp gochujang'), 'Pantry');
check('star anise lands in Spices', guessCategory('3 star anise pods'), 'Spices');
check('feta lands in Dairy', guessCategory('100g feta'), 'Dairy');
check('duck lands in Protein', guessCategory('2 duck legs'), 'Protein');
check('dill lands in Produce', guessCategory('fresh dill'), 'Produce');
// The form of a spice outranks its substance, which is what keeps fresh
// chillies out of the spice rack.
check('chilli powder is a spice', guessCategory('1 tsp red chilli powder'), 'Spices');
check('  a fresh chilli is not', guessCategory('2 green chillies'), 'Produce');
check('cardamom lands in Spices', guessCategory('4 green cardamom pods'), 'Spices');
check('paneer lands in Dairy', guessCategory('200g paneer'), 'Dairy');
check('lamb lands in Protein', guessCategory('500g lamb shoulder'), 'Protein');
check('spinach lands in Produce', guessCategory('a bag of spinach'), 'Produce');
check('label is the normalised name, capitalised',
    labelFor('2 tbsp gochujang'), 'Gochujang');
check('  and it drops the noise', labelFor('1 lb chicken thighs, trimmed'), 'Chicken Thigh');

console.log('\nbuildMatcher() edge cases:');
check('an empty pantry matches nothing', buildMatcher([]).matchOne('salt').confidence, 'none');
check('null rows are skipped', buildMatcher([null, { name: 'salt' }]).size, 1);
check('rows without a name are skipped', buildMatcher([{ in_stock: true }]).size, 0);

console.log('\naliases carried by the pantry itself:');
{
    const taught = buildMatcher([
        ...PANTRY,
        { name: 'arugula', label: 'arugula', in_stock: true, aliases: ['rocket', 'roquette'] },
        { name: 'gochujang', label: 'gochujang', in_stock: true, aliases: ['korean chilli paste'] },
    ]);
    const say = (line) => {
        const r = taught.matchOne(line);
        return r.item ? `${r.item.name}:${r.confidence}` : 'none';
    };
    check('a taught alias finds the ingredient', say('2 cups roquette'), 'arugula:exact');
    check('a multi-word alias works too', say('1 tbsp korean chilli paste'), 'gochujang:exact');
    check('the real name still works', say('gochujang'), 'gochujang:exact');
    check('an alias hit is flagged as such',
        taught.matchOne('roquette').byAlias, true);
    check('a plain name hit is not', Boolean(taught.matchOne('gochujang').byAlias), false);
    check('an alias cannot steal another ingredient\'s name',
        buildMatcher([
            { name: 'salt', in_stock: true },
            { name: 'msg', in_stock: false, aliases: ['salt'] },
        ]).matchOne('salt').item.name, 'salt');
}

console.log('\nsuggest() — the shortlist offered when linking by hand:');
{
    const names = (line, n) => m.suggest(line, n).map((s) => s.item.name);

    // A line the matcher DID resolve still offers alternatives, because the
    // whole point is being able to say "no, not that one".
    check('a resolved line still offers alternatives',
        names('1 tsp chilli powder', 3).includes('kashmiri red chilli powder'), true);

    // The hard case: nothing shares a single word with it. Word-level scoring
    // has nothing to say, so character similarity has to carry the list.
    const g = names('2 tbsp gochujang', 5);
    check('an unmatched line still gets a shortlist', g.length, 5);
    check('  and it is never a match', m.matchOne('2 tbsp gochujang').item, null);

    check('the best suggestion for a near-miss is the right one',
        names('shiitake mushrooms', 1), ['dried shiitake mushrooms']);
    check('stocked rows come first on a tie',
        m.suggest('cilantro', 1)[0].item.in_stock, true);
    check('an empty line suggests nothing', m.suggest('', 5), []);
    check('the limit is respected', m.suggest('salt', 2).length, 2);

    // A suggestion must never be scored high enough to look like a match, or
    // the threshold in matchOne stops meaning anything.
    const weak = m.suggest('2 tbsp gochujang', 8);
    check('suggestion scores stay below the match threshold',
        weak.every((s) => s.score < 0.45), true);
}

console.log('\nan alias on a duplicated row — the bug Neha hit:');
{
    // Production holds `cilantro` twice: Pantry (stocked) and Produce (empty).
    // Teaching "coriander" wrote the alias onto the empty copy, so the line
    // resolved to a cilantro she did not have while a stocked one sat right
    // there - and the row stayed unticked, which read as "linking did nothing".
    const dup = buildMatcher([
        { id: 'A', name: 'cilantro', in_stock: true, aliases: [] },
        { id: 'B', name: 'cilantro', in_stock: false, aliases: ['coriander'] },
    ]);
    const hit = dup.matchOne('a handful of coriander');
    check('an alias resolves to the stocked copy of its ingredient',
        `${hit.item?.id}:${hit.item?.in_stock}`, 'A:true');
    check('  so the recipe row actually ticks',
        dup.matchRecipe([{ item: 'a handful of coriander' }]).lines[0].inStock, true);

    // But an alias must still not drag a *different* ingredient along.
    const other = buildMatcher([
        { id: 'A', name: 'cottage cheese', in_stock: false, aliases: ['goat cheese'] },
        { id: 'B', name: 'chevre', in_stock: true, aliases: [] },
    ]);
    check('an alias does not jump to an unrelated stocked row',
        other.matchOne('100g goat cheese').item.id, 'A');
    check('  and an out-of-stock match is reported as such, not as unmatched',
        other.matchRecipe([{ item: '100g goat cheese' }]).outOfStock.length, 1);
}

console.log('\nwords that are both a unit and an ingredient — the cloves bug:');
{
    // `cloves` is a unit ("3 cloves garlic") and a spice in its own right.
    // Stripping it as a measure left the empty string, so the pantry row named
    // `cloves` was dropped from the index entirely: it could never match, and
    // linking to it wrote an alias onto a row nothing could reach.
    check('a lone unit word survives', normalise('cloves').text, 'clove');
    check('  and so does a measured amount of it', normalise('1 tsp cloves').text, 'clove');
    check('  while it is still a unit in measure position',
        normalise('3 cloves garlic').text, 'garlic');
    check('  singular too', normalise('1 clove garlic').text, 'garlic');
    check('a lone number still names nothing', normalise('2').text, '');

    const spice = buildMatcher([
        { id: 'C', name: 'cloves', in_stock: true, aliases: ['laung'] },
        { id: 'G', name: 'garlic', in_stock: true, aliases: [] },
    ]);
    check('the row is indexed at all', spice.size, 2);
    check('"1 tsp cloves" finds the spice', spice.matchOne('1 tsp cloves').item.id, 'C');
    check('"3 cloves garlic" still finds garlic', spice.matchOne('3 cloves garlic').item.id, 'G');
    check('and its taught alias works', spice.matchOne('1 tsp laung').item.id, 'C');
}

console.log('\na buried synonym must not change what a line is about:');
{
    // `thai chilli` -> `bird's eye chilli` fired on "thai chilli paste", so a
    // jar of paste resolved to a fresh chilli. The head noun decides.
    check('a jar of paste stays a paste', normalise('2 tbsp thai chilli paste').text, 'thai chilli paste');
    check('  but the chilli itself still resolves', normalise('2 thai chillies').text, 'bird eye chilli');
    check('  and a long-winded spice name still resolves',
        normalise('deggi mirch indian chilli powder').text, 'red chilli powder');
}

console.log('\nlines made only of measure words still name something:');
{
    // "3 cloves" on its own reduced to the empty string before the fallback
    // existed, which made the link popover offer to add "" as an ingredient and
    // made addAlias discard the write - so linking it appeared to do nothing,
    // however many times it was tried.
    for (const line of ['3 cloves', '2 cups', '1 head', '4 sprigs', '2 sticks']) {
        check(`"${line}" is not stripped to nothing`, normalise(line).text !== '', true);
    }
    check('  and "3 cloves" names the spice', normalise('3 cloves').text, 'clove');
    check('  while "3 cloves garlic" still names the garlic',
        normalise('3 cloves garlic').text, 'garlic');
    // A line with genuinely no ingredient in it should still come back empty,
    // so the UI can say so rather than pretending.
    check('a line of pure quantity names nothing', normalise('2').text, '');
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
