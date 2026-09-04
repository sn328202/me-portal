/**
 * The Wardrobe wearing the portal's palette.
 *
 * Colour arithmetic is exactly the sort of code that looks right and is off by
 * a channel, and the failure mode here is a page that is merely slightly wrong
 * — unreadable white text on a pale accent, a "cold" pill in orange — which is
 * the kind of wrong nobody files a bug about and everybody notices.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import {
    TOKEN_MAP, fontHref, hueOf, luminance, contrast, nearestHue, wardrobeVars, wardrobeCss,
} from '../src/utils/wardrobeTheme.js';

/* themes.jsx is JSX, and its only JSX is the icon elements. Strip them and the
   rest is a plain data module — the same trick theme-test.mjs uses. */
const source = fs.readFileSync('src/configs/themes.jsx', 'utf8')
    .replace(/^import[\s\S]*?from 'react-icons\/gi';\n/m, '')
    .replace(/^import React from 'react';\n/m, '')
    .replace(/<Gi\w+\s*\/>/g, 'null');
const tmp = path.join(os.tmpdir(), `themes-for-wardrobe-${process.pid}.mjs`);
fs.writeFileSync(tmp, source);
const { THEMES, THEME_CHARACTER, paletteVars } = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

console.log('\ncolour arithmetic:');
check('red is at zero degrees', hueOf('#ff0000'), 0);
check('green is a third of the way round', Math.round(hueOf('#00ff00')), 120);
check('blue is two thirds', Math.round(hueOf('#0000ff')), 240);
check('a grey has no hue to be near', hueOf('#888888'), null);
check('three-digit hex works too', hueOf('#f00'), 0);
check('nonsense is not a colour', hueOf('rgb(1,2,3)'), null);

// Perceived, not average: green reads far brighter than blue at equal value.
check('white is fully light', Math.round(luminance('#ffffff')), 1);
check('black is not', luminance('#000000'), 0);
check('green outshines blue',
    luminance('#00ff00') > luminance('#0000ff'), true);

check('the bluest of a palette wins the cold slot',
    nearestHue(['#b4543f', '#5b7c5a', '#4a6284', '#c9944e'], 210), '#4a6284');
check('and the warmest takes hot',
    nearestHue(['#b4543f', '#5b7c5a', '#4a6284', '#c9944e'], 20), '#b4543f');
check('greys never win, since they are not the colour of anything',
    nearestHue(['#888888', '#4a6284'], 210), '#4a6284');
check('a palette of nothing but greys gives up',
    nearestHue(['#888888', '#777777'], 210), null);
check('an empty palette gives up too', nearestHue([], 210), null);

check('black on white is the widest contrast there is',
    Math.round(contrast('#000000', '#ffffff')), 21);
check('a colour has no contrast with itself', contrast('#9b6a4f', '#9b6a4f'), 1);
check('contrast does not care which way round', contrast('#000', '#fff'), contrast('#fff', '#000'));
check('a colour it cannot read is not a contrast', contrast('nope', '#fff'), 0);

/* --- every theme, since a broken one is invisible until she picks it ----- */
console.log('\nevery theme hands over a full set:');
{
    const ids = Object.keys(THEMES);
    check('there are themes to check', ids.length > 1, true);

    const problems = [];
    for (const id of ids) {
        const theme = THEMES[id];
        // Character first, exactly as ThemeContext layers them.
        const all = { ...(THEME_CHARACTER[id] || {}), ...theme.cssVars, ...paletteVars(id) };
        const vars = wardrobeVars((name) => all[name] || '');

        // Every planner variable must be answered, or that corner of the page
        // silently keeps Studio's colour.
        for (const key of Object.keys(TOKEN_MAP)) {
            if (!vars[key]) problems.push(`${id} has no ${key}`);
        }
        if (!vars['--cold']) problems.push(`${id} has no cold hue`);
        if (!vars['--hot']) problems.push(`${id} has no hot hue`);
        if (!vars['--on-accent']) problems.push(`${id} has no text for its accent`);

        // Buttons are bold 14px, so 3:1 is the bar. Eight-bit's accent is
        // #ffff00 and its ink is #ffffff — a lightness threshold picked the ink
        // and wrote white on yellow, which is how this check came to exist.
        const ratio = contrast(vars['--accent'], vars['--on-accent']);
        if (ratio < 3) {
            problems.push(`${id}: ${vars['--on-accent']} on ${vars['--accent']} is only ${ratio.toFixed(1)}:1`);
        }
    }
    check('nothing is left unanswered', problems, []);
}

console.log('\nthe stylesheet it produces:');
{
    const light = { '--bg-main': '#f6f5f3', '--bg-panel': '#ffffff', '--text-main': '#23201c' };
    const css = wardrobeCss((n) => light[n] || '');
    check('it targets :root, so it can override the planner\'s own',
        css.startsWith(':root{'), true);
    check('the room colour comes across', css.includes('--bg:#f6f5f3'), true);
    // Checkboxes and date pickers are painted by the browser and ignore every
    // variable; color-scheme is the only lever on them.
    check('a light room asks for light controls', css.includes('color-scheme:light'), true);

    const dark = { '--bg-main': '#14110d', '--bg-panel': '#1c1813', '--text-main': '#e8e0d0' };
    check('a dark room asks for dark ones',
        wardrobeCss((n) => dark[n] || '').includes('color-scheme:dark'), true);

    check('nothing to say means nothing said', wardrobeCss(() => ''), '');
}

console.log('\nfinding the fonts to hand across:');
{
    /* The bug this exists for: the planner is a second document, and a face
       declared only in the portal's stylesheet does not reach it. Proven with
       a real browser — same family, same size, same weight, and the iframe
       drew 161px where the portal drew 190px because the iframe had zero
       faces loaded. So the href has to be found and copied over, and found by
       reading rather than by remembering. */
    const IMPORT = 'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap';
    const sheet = (rules) => ({ get cssRules() { return rules; } });

    check('it finds the @import in our own stylesheet',
        fontHref({ styleSheets: [sheet([{ href: IMPORT }])] }), IMPORT);

    check('it looks past the rules that are not imports',
        fontHref({ styleSheets: [sheet([{ selectorText: '.x' }, { href: IMPORT }])] }), IMPORT);

    check('it looks past a stylesheet with nothing in it',
        fontHref({ styleSheets: [sheet([]), sheet([{ href: IMPORT }])] }), IMPORT);

    // An extension's stylesheet throws on .cssRules. One of those must not be
    // able to take the whole Wardrobe's typography down with it.
    const hostile = { get cssRules() { throw new Error('cross-origin'); } };
    check('a stylesheet it is not allowed to read is stepped over',
        fontHref({ styleSheets: [hostile, sheet([{ href: IMPORT }])] }), IMPORT);

    // Vite emits a <link> in production and an injected <style> in dev; if the
    // shape ever changes, the link is the second place to look.
    check('a plain <link> is the fallback',
        fontHref({ styleSheets: [], querySelector: () => ({ href: IMPORT }) }), IMPORT);

    check('an import to somewhere else is not a font sheet',
        fontHref({ styleSheets: [sheet([{ href: 'https://example.com/a.css' }])] }), null);

    check('no fonts anywhere is null, not a crash', fontHref({ styleSheets: [] }), null);
    check('no document at all is null, not a crash', fontHref(null), null);
}

/* The URL it will be reading, at the top of index.css. If this @import ever
   moves or is inlined, fontHref finds nothing and the Wardrobe goes back to
   Helvetica without a word — so the test knows where it lives. */
{
    const css = fs.readFileSync('src/index.css', 'utf8');
    check('index.css still holds the @import fontHref is looking for',
        /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com/.test(css), true);
}

/* And the planner still declares none of its own — if it ever grows a <link>
   of its own this whole mechanism is redundant and should go. */
{
    const html = fs.readFileSync('public/outfit-planner.html', 'utf8');
    check('the planner itself still loads no fonts',
        /fonts\.googleapis\.com|@font-face/.test(html), false);
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
