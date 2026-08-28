/**
 * The colour a plan wears.
 *
 * Two things here are easy to get wrong in a way that looks fine. The ink is
 * picked by contrast rather than by lightness, because eight-bit's palette
 * contains #ffff00 and a lightness threshold writes white on it. And a plan
 * with no colour of its own must return *nothing*, not a style object full of
 * undefineds, or it overrides the stylesheet's rule for its kind with blank.
 */

import { HUES, hueVar, inkOn, blockPalette, blockStyle } from '../src/utils/blockColour.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

/* A theme's worth of variables, as getComputedStyle would hand them over. */
const theme = (hues, panel, main) => (name) => {
    if (name === '--bg-panel') return panel;
    if (name === '--text-main') return main;
    const m = /^--c-([1-8])$/.exec(name);
    return m ? (hues[Number(m[1]) - 1] || '') : '';
};

const studio = theme(
    ['#8c5a3c', '#4f6b52', '#7a6a9c', '#b08968', '#5b7c99', '#9c6b6b', '#6b8f71', '#a08a5b'],
    '#fffaf3', '#2b2118'
);

console.log('\nthe hues on offer:');
check('there are eight', HUES, [1, 2, 3, 4, 5, 6, 7, 8]);
check('and they are named by number', hueVar(3), '--c-3');

console.log('\npicking ink that can be read:');
check('dark fill takes the pale ink', inkOn('#2b2118', '#fffaf3', '#2b2118'), '#fffaf3');
check('pale fill takes the dark ink', inkOn('#f5e9d8', '#fffaf3', '#2b2118'), '#2b2118');
check(
    'yellow takes black, not white — lightness would say otherwise',
    inkOn('#ffff00', '#ffffff', '#000000'),
    '#000000'
);
check('an unreadable pair still returns something', inkOn('', '#fff', '#000'), '#000');

console.log('\nthe palette as a theme has it:');
const palette = blockPalette(studio);
check('eight entries', palette.length, 8);
check('each knows its number', palette.map((h) => h.n), HUES);
check('the first is the theme\'s first hue', palette[0].fill, '#8c5a3c');
check('and it is written on in the panel colour', palette[0].ink, '#fffaf3');

console.log('\na theme that declares no hues:');
const bare = blockPalette(theme([], '#fff', '#111'));
check('still gives eight slots', bare.length, 8);
check('with nothing to fill them', bare[0].fill, '');
check('and falls back to the main ink', bare[0].ink, '#111');

console.log('\nwhat a plan wears:');
check('an uncoloured plan wears nothing of its own', blockStyle({ title: 'x' }, palette), null);
check('a coloured one wears its hue', blockStyle({ colour: 2 }, palette), {
    background: '#4f6b52', color: '#fffaf3',
});
check('the eighth hue is reachable', blockStyle({ colour: 8 }, palette).background, '#a08a5b');
check('a number outside the palette is ignored', blockStyle({ colour: 9 }, palette), null);
check('so is zero', blockStyle({ colour: 0 }, palette), null);
check('so is a word', blockStyle({ colour: 'red' }, palette), null);
check('a hue the theme never declared is ignored', blockStyle({ colour: 1 }, bare), null);

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
