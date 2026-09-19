import assert from 'node:assert/strict';
import { normalise, buildMatcher } from '../src/utils/ingredientMatch.js';

/**
 * The matcher's hot loop, pinned.
 *
 * `normalise()` used to canonicalise the entire synonym table inside its own
 * loop — a hundred and forty flatten/split/singularise passes over constant
 * strings, on every ingredient line, every time. It was 92% of the runtime of
 * the function that the recipe list, the pantry page, the shopping list and
 * the recipe form all call thousands of times to draw one screen.
 *
 * Hoisting it is four lines. The risk is not that it breaks loudly: it is that
 * one line in a hundred quietly resolves to something else and a recipe starts
 * telling her she has no coriander. So the fixture below is a hundred and
 * thirty real ingredient lines out of her own recipes, with the answers the
 * old implementation gave, asserted byte for byte.
 */

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok   ${name}`); };

const CORPUS = [
    ["1/2 tsp chilli flakes", "chilli flake"],
    ["300 ml sherry vinegar", "sherry vinegar"],
    ["3 pcs egg yolks", "egg yolk"],
    ["500 ml water", "water"],
    ["2 tablespoons olive oil", "olive oil"],
    ["1 2- pcs ginger", "ginger"],
    ["3/4 cup heavy cream", "heavy cream"],
    ["2 pcs chopped onions", "onion"],
    ["1 tablespoon Onion Powder", "onion powder"],
    ["1 pc jalapeno", "jalapeno"],
    ["2 tsp coriander powder", "coriander powder"],
    ["1 pcs 120g (1/2 Cup) Pumpkin Pur\u00e9e", "pumpkin puree"],
    ["1 Tablespoon sesame oil", "sesame oil"],
    ["1 cup half-and-half", "half and half"],
    ["80 g high-protein Greek yogurt", "high protein greek yogurt"],
    ["1 pound pasta", "pasta"],
    ["500 g chicken mince", "chicken mince"],
    ["2 tablespoons vegetable oil", "vegetable oil"],
    ["1 pcs Dried chilis", "dried chilli"],
    ["1 tbsp cooked chickpeas", "chickpea"],
    ["40 ml vegetable oil", "vegetable oil"],
    ["2 pcs nice tomatoes", "tomato"],
    ["1 pcs 5g (2 tsp) Oat Flour", "oat flour"],
    ["1 tsp chilli powder", "chilli powder"],
    ["1 tbsp lao gan ma", "lao gan ma"],
    ["1 can of creamed corn", "creamed corn"],
    ["1/2 tsp salt", "salt"],
    ["1 pcs cashews", "cashew"],
    ["9 pcs dried porcini mushrooms", "dried porcini mushroom"],
    ["1 pcs Cilantro", "cilantro"],
    ["3 tbsps red wine vinegar", "tbsp red wine vinegar"],
    ["1 pcs 4-5 cloves", "pcs clove"],
    ["100 grams semolina flour", "semolina flour"],
    ["1 pcs salt to taste", "salt"],
    ["\u00bc tsp deggi mirch chilli powder", "red chilli powder"],
    ["4-5 pcs Tomatoes cut into 2cm slices", "tomato cut into 2cm slice"],
    ["1/2 pcs turmeric", "turmeric"],
    ["200 g full-fat Greek yoghurt", "full fat greek yogurt"],
    ["1/2 pcs Red Onion", "red onion"],
    ["1 pcs Pinch of hing", "hing"],
    ["\u00bd tsp dried chilli flakes", "dried chilli flake"],
    ["3/4 cup Yogurt", "yogurt"],
    ["150 ml Water", "water"],
    ["1 cup ricotta", "ricotta"],
    ["1/2 cup olive oil", "olive oil"],
    ["3 tablespoons unsalted butter", "unsalted butter"],
    ["2 pcs garlic", "garlic"],
    ["1 pcs Chilli crisp", "lao gan ma"],
    ["1 pcs MSG", "msg"],
    ["1 tsp fennel seeds", "fennel seed"],
    ["1 pcs \u00bd tsp (1g) coffee powder", "coffee powder"],
    ["1/2 cup Mayonnaise", "mayonnaise"],
    ["1 pcs White fish", "white fish"],
    ["1/2 tsp cumin seeds", "cumin seed"],
    ["\u00bc cup Soy Sauce", "soy sauce"],
    ["1 pcs Egg white", "egg white"],
    ["10 g cornflour", "cornstarch"],
    ["1 pcs 20g (2/3 Scoop) Whey/Casein Blend Protein Powder", "scoop whey casein blend protein powder"],
    ["1 pcs Oil", "oil"],
    ["1 pcs big red onion", "red onion"],
    ["\u00bd cup vegetable oil", "vegetable oil"],
    ["200 g vegetable broth", "vegetable broth"],
    ["2 pinches of deggi mirch chilli powder", "red chilli powder"],
    ["1 pcs Sumac", "sumac"],
    ["jalapeno", "jalapeno"],
    ["1 pcs jeera", "cumin seed"],
    ["1 pcs medium onion", "onion"],
    ["1 pcs 2g (1/3 tsp) Baking Soda", "baking soda"],
    ["1 pcs Handful of fresh coriander", "cilantro"],
    ["4 pcs eggs", "egg"],
    ["\u00bd handful curry leaves", "curry leaf"],
    ["2 Tablespoons cornstarch", "cornstarch"],
    ["1 pcs vegetable oil", "vegetable oil"],
    ["\u00bc cup unsalted butter, melted", "unsalted butter"],
    ["4 g ginger paste", "ginger paste"],
    ["1 pcs star anise", "star anise"],
    ["2 cups water", "water"],
    ["1 bunch asparagus", "asparagus"],
    ["1 lb. pasta", "pasta"],
    ["1/2 teaspoon salt", "salt"],
    ["1 tablespoon ginger", "ginger"],
    ["1 pcs Eggs", "egg"],
    ["30 g yogurt", "yogurt"],
    ["\u00bd tsp fine sea salt", "flaky sea salt"],
    ["250 g dried chickpeas", "dried chickpea"],
    ["1 pcs 10 mL (2 tsp) water", "water"],
    ["2 tablespoons cilantro", "cilantro"],
    ["1 pcs coriander or spring onions", "coriander or spring onion"],
    ["5 g fresh root ginger", "fresh root ginger"],
    ["6 pcs garlic cloves", "garlic clove"],
    ["1 pcs Corn starch", "cornstarch"],
    ["50 ml water", "water"],
    ["1 pcs Black pepper", "black pepper"],
    ["1 pcs Bag of corn tortillas", "corn tortilla"],
    ["1/3 cup beef bone broth", "beef bone broth"],
    ["1 tsp chili powder", "chilli powder"],
    ["\u00bd tsp cumin seeds", "cumin seed"],
    ["5 g fine sea salt", "flaky sea salt"],
    ["6-7 pcs black peppercorns", "black peppercorn"],
    ["5 pcs Eggs", "egg"],
    ["coriander powder", "coriander powder"],
    ["10 pcs curry leaves", "curry leaf"],
    ["\u00bd tsp peppercorns", "black peppercorn"],
    ["1 pcs Corn starch slurry", "corn starch slurry"],
    ["1 pcs ginger", "ginger"],
    ["3 pcs Tomato", "tomato"],
    ["1 pcs cayenne pepper", "cayenne pepper"],
    ["3 pcs dried shiitake mushrooms", "dried shiitake mushroom"],
    ["2 tbsp coriander leaves", "cilantro"],
    ["1 pcs Green salsa verde", "green salsa verde"],
    ["1 pcs Chopped ginger", "ginger"],
    ["2 pcs shallot", "shallot"],
    ["1 pcs small stick of cinnamon", "stick of cinnamon"],
    ["2 pcs chopped green chillies", "green chilli"],
    ["4 ounces bittersweet chocolate", "bittersweet chocolate"],
    ["1/2- 1 1/2 tablespoons Sichuan peppercorns", "sichuan peppercorn"],
    ["20 g raisins", "raisin"],
    ["\u00bd tsp \"magic\" masala", "magic masala"],
    ["1 pcs Black pepper powder", "black pepper powder"],
    ["1 pcs Sweet tamarind chutney", "sweet tamarind chutney"],
    ["get deggi mirch indian chilli powder", "red chilli powder"],
    ["1 bay leaf", "bay leaf"],
    ["2 tbsp freshly ground black pepper", "ground black pepper"],
    ["thai chilli paste", "thai chilli paste"],
    ["3 cloves garlic", "garlic"],
    ["1 tsp cloves", "clove"],
    ["a handful of chopped coriander", "coriander"],
    ["coriander leaf", "cilantro"],
    ["cloves", "clove"],
    ["2", ""]
];

console.log('a hundred and thirty real lines, unchanged:');

t('every line normalises exactly as it did before', () => {
    const drifted = CORPUS
        .map(([line, want]) => [line, want, normalise(line).text])
        .filter(([, want, got]) => got !== want);
    assert.deepEqual(drifted, [], drifted.length
        ? `these lines changed meaning: ${JSON.stringify(drifted.slice(0, 5))}`
        : '');
});

t('including the three the file documents itself by', () => {
    // From ingredientMatch.js's own docstring — the cases the synonym rules
    // exist for.
    assert.equal(normalise('get deggi mirch indian chilli powder').text, 'red chilli powder');
    assert.equal(normalise('1 bay leaf').text, 'bay leaf');
    assert.equal(normalise('2 tbsp freshly ground black pepper').text, 'ground black pepper');
});

t('and the one it must NOT collapse', () => {
    // A jar of chilli paste is not a fresh chilli, however many words they share.
    assert.notEqual(normalise('thai chilli paste').text, normalise("bird's eye chilli").text);
});

console.log('\nand it is no longer the slowest thing on the page:');

t('a screenful of lines normalises in well under a second', () => {
    /* 2,600 calls is roughly what drawing the recipe list costs. Measured:
       552ms before the hoist, 49ms after. The threshold is 250ms — five times
       the real figure, so it will not flake on a slow machine, and less than
       half the old one, so it cannot pass if the loop comes back. */
    for (let i = 0; i < 5; i += 1) for (const [line] of CORPUS) normalise(line);   // warm
    const started = process.hrtime.bigint();
    for (let i = 0; i < 20; i += 1) for (const [line] of CORPUS) normalise(line);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(ms < 250, `2,600 normalise calls took ${ms.toFixed(0)}ms`);
});

t('and building the matcher is cheap enough to do on every pantry change', () => {
    const pantry = CORPUS.map(([line], i) => ({ id: `i${i}`, label: line.slice(0, 30) }));
    for (let i = 0; i < 3; i += 1) buildMatcher(pantry);
    const started = process.hrtime.bigint();
    buildMatcher(pantry);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(ms < 20, `buildMatcher over ${pantry.length} rows took ${ms.toFixed(1)}ms`);
});

console.log(`\nnormalise: ${n} passed`);
