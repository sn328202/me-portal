/**
 * Fixture tests for the server-side recipe extractor.
 *
 * The parse half is separated from the fetch half precisely so it can be run
 * against saved HTML shapes rather than live sites. The three fixtures below
 * are the three markup patterns that cover essentially every recipe site:
 * a bare Recipe object, a Recipe inside an @graph, and HowToSection-nested
 * instructions with @type as an array.
 */
import { parseRecipeHtml, parseIngredient } from '../api/_recipe.js';

let failed = 0;
const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`}`);
};

const page = (ld) => `<html><head><title>x</title>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head><body></body></html>`;

console.log('\nparseIngredient():');
check('amount + unit + item', parseIngredient('2 cups all-purpose flour'),
    { amount: '2', unit: 'cups', item: 'all-purpose flour', notes: '' });
check('mixed number', parseIngredient('1 1/2 tablespoons olive oil'),
    { amount: '1 1/2', unit: 'tablespoons', item: 'olive oil', notes: '' });
check('note in parentheses', parseIngredient('3 cloves garlic (thinly sliced)'),
    { amount: '3', unit: 'cloves', item: 'garlic', notes: 'thinly sliced' });
check('note after comma', parseIngredient('1 pound asparagus, trimmed'),
    { amount: '1', unit: 'pound', item: 'asparagus', notes: 'trimmed' });
check('size word is not a unit', parseIngredient('2 large eggs'),
    { amount: '2', unit: 'pcs', item: '2 large eggs'.replace('2 ', ''), notes: '' });
check('no amount at all', parseIngredient('Kosher salt'),
    { amount: '1', unit: 'pcs', item: 'Kosher salt', notes: '' });
// Ranges written with an en dash are ordinary in recipe captions; splitting
// one produced "2 pcs -2.5 cups chicken broth".
check('en-dash range stays one amount', parseIngredient('2\u20132.5 cups chicken broth'),
    { amount: '2\u20132.5', unit: 'cups', item: 'chicken broth', notes: '' });
check('hyphen range too', parseIngredient('2-3 green onions'),
    { amount: '2-3', unit: 'pcs', item: 'green onions', notes: '' });

console.log('\nparseRecipeHtml() — bare Recipe object:');
{
    const r = parseRecipeHtml(page({
        '@context': 'https://schema.org', '@type': 'Recipe',
        name: 'Caramelized Corn &amp; Asparagus Pasta',
        recipeIngredient: ['1 pound asparagus, trimmed', '2 cups corn kernels', 'Kosher salt'],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil the pasta.' }, { '@type': 'HowToStep', text: 'Char the corn.' }],
        totalTime: 'PT35M', prepTime: 'PT10M',
        recipeYield: ['4 servings'],
        image: ['https://example.com/a.jpg'],
    }), 'https://cooking.nytimes.com/recipes/1024752');
    check('decodes the title', r.title, 'Caramelized Corn & Asparagus Pasta');
    check('all ingredients parsed', r.ingredients.length, 3);
    check('first ingredient', r.ingredients[0], { amount: '1', unit: 'pound', item: 'asparagus', notes: 'trimmed' });
    check('instructions joined', r.instructions, 'Boil the pasta.\nChar the corn.');
    check('ISO duration', r.total_time, '35m');
    check('yield array', r.servings, '4 servings');
    check('image array', r.image_url, 'https://example.com/a.jpg');
    check('marked complete', r.complete, true);
}

console.log('\nparseRecipeHtml() — Recipe inside @graph, @type as array:');
{
    const r = parseRecipeHtml(page({
        '@context': 'https://schema.org',
        '@graph': [
            { '@type': 'WebSite', name: 'Some Blog' },
            { '@type': ['Recipe', 'NewsArticle'], name: 'Braised Short Ribs',
              recipeIngredient: ['3 pounds short ribs'],
              recipeInstructions: { '@type': 'HowToSection', itemListElement: [{ '@type': 'HowToStep', text: 'Sear.' }] },
              cookTime: 'PT2H30M' },
        ],
    }), 'https://example.com/r');
    check('found inside @graph', r.title, 'Braised Short Ribs');
    check('nested HowToSection', r.instructions, 'Sear.');
    check('hours and minutes', r.cook_time, '2h 30m');
}

console.log('\nparseRecipeHtml() — resilience:');
{
    const html = `<html><head>
      <script type="application/ld+json">{ this is not valid json }</script>
      <script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'Survived', recipeIngredient: ['1 cup rice'] })}</script>
      </head><body></body></html>`;
    check('one broken block does not lose the good one', parseRecipeHtml(html, 'https://example.com/r').title, 'Survived');
}
{
    const html = '<html><head><meta property="og:title" content="Mystery Stew" /></head><body></body></html>';
    const r = parseRecipeHtml(html, 'https://example.com/r');
    check('falls back to og:title', r.title, 'Mystery Stew');
    check('and reports it is a stub', r.complete, false);
}
{
    let threw = false;
    try { parseRecipeHtml('<html><body>nothing</body></html>', 'https://example.com/r'); } catch { threw = true; }
    check('throws when there is nothing at all', threw, true);
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
