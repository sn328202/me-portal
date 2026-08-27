/**
 * Theme completeness and palette tests.
 *
 * ThemeContext writes every variable as an *inline property on :root* and
 * never clears them between switches. So a key that one theme sets and
 * another omits does not fall back to the stylesheet — it keeps the previous
 * theme's value, and the bug only shows after switching in a particular
 * order. That is the class of failure this file exists to catch.
 *
 * The palette assertions are the other half: eight hues per theme are only
 * worth having if they are actually eight *different* hues.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

let failed = 0;
const check = (label, ok, detail = '') => {
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

/* themes.jsx is JSX, and its only JSX is the icon elements — which carry no
   data worth testing. Strip them and the rest is a plain data module. */
const source = fs.readFileSync('src/configs/themes.jsx', 'utf8')
    .replace(/^import[\s\S]*?from 'react-icons\/gi';\n/m, '')
    .replace(/^import React from 'react';\n/m, '')
    .replace(/<Gi\w+\s*\/>/g, 'null');

const tmp = path.join(os.tmpdir(), `themes-under-test-${process.pid}.mjs`);
fs.writeFileSync(tmp, source);
const { THEMES, THEME_CHARACTER, paletteOf, paletteVars } = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

const ids = Object.keys(THEMES);

console.log(`\nshape — ${ids.length} themes:`);
for (const id of ids) {
    const t = THEMES[id];
    check(`${id}: id matches its key`, t.id === id, `id is ${t.id}`);
    check(`${id}: has a name`, typeof t.name === 'string' && t.name.length > 0);
    check(`${id}: fontImports is a list`, Array.isArray(t.fontImports));
    for (const part of ['cssVars', 'labels', 'icons']) {
        check(`${id}: has ${part}`, t[part] && typeof t[part] === 'object');
    }
}

/* ---- no theme may omit a variable another theme sets ------------------ */

const keyUnion = (pick) => {
    const all = new Set();
    for (const id of ids) Object.keys(pick(id)).forEach((k) => all.add(k));
    return all;
};

/* cssVars and THEME_CHARACTER are merged before they are written, so the
   invariant is on the union of the two, not on either half. Six themes leave
   --fill-strong out of cssVars and set it in their character entry, which is
   fine; a variable missing from *both* is the actual failure. */
const declared = (id) => ({ ...(THEME_CHARACTER[id] || {}), ...THEMES[id].cssVars });

console.log('\nevery theme declares every variable the others do:');
{
    const all = keyUnion(declared);
    for (const id of ids) {
        const missing = [...all].filter((k) => !(k in declared(id)));
        check(`${id} (${all.size} variables)`, missing.length === 0, `missing ${missing.join(', ')}`);
    }
}

console.log('\nTHEME_CHARACTER — one entry per theme, all keys present:');
{
    for (const id of ids) {
        check(`${id} has a character entry`, Boolean(THEME_CHARACTER[id]));
    }
    const all = keyUnion((id) => THEME_CHARACTER[id] || {});
    for (const id of ids) {
        const missing = [...all].filter((k) => !(k in (THEME_CHARACTER[id] || {})));
        check(`${id} (${all.size} keys)`, missing.length === 0, `missing ${missing.join(', ')}`);
    }
    const extra = Object.keys(THEME_CHARACTER).filter((id) => !ids.includes(id));
    check('no orphan character entries', extra.length === 0, `orphans: ${extra.join(', ')}`);
}

/* ---- the palettes ----------------------------------------------------- */

const HEX = /^#[0-9a-f]{6}$/i;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/* Plain Euclidean distance in RGB. Crude, but it is only being asked to
   separate "two different colours" from "the same brown twice", and for
   that it is entirely sufficient. */
const apart = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

console.log('\npalettes — eight distinct hues each:');
for (const id of ids) {
    const p = THEMES[id].palette;
    check(`${id}: eight entries`, Array.isArray(p) && p.length === 8, `got ${p ? p.length : 'none'}`);
    if (!Array.isArray(p) || p.length !== 8) continue;

    check(`${id}: every entry is a named hex`,
        p.every((c) => c && typeof c.name === 'string' && c.name && HEX.test(c.hex || '')),
        JSON.stringify(p.filter((c) => !HEX.test((c && c.hex) || ''))));

    check(`${id}: no repeated colour`, new Set(p.map((c) => c.hex.toLowerCase())).size === 8);

    let closest = { d: Infinity, pair: '' };
    for (let i = 0; i < p.length; i += 1) {
        for (let j = i + 1; j < p.length; j += 1) {
            const d = apart(p[i].hex, p[j].hex);
            if (d < closest.d) closest = { d, pair: `${p[i].name} / ${p[j].name}` };
        }
    }
    // 40 is about the point where two swatches side by side stop reading as
    // one colour. Matrix sits closest to it on purpose: it is a phosphor
    // terminal, and a phosphor terminal is mostly one hue.
    check(`${id}: closest pair is separable (${Math.round(closest.d)})`,
        closest.d >= 40, `${closest.pair} are only ${Math.round(closest.d)} apart`);
}

console.log('\npaletteVars():');
{
    const vars = paletteVars('retro');
    check('gives --c-1 … --c-8', Object.keys(vars).join(','),
        Object.keys(vars).join(',') === '--c-1,--c-2,--c-3,--c-4,--c-5,--c-6,--c-7,--c-8');
    check('  --c-1 is the theme\'s first hue', vars['--c-1'] === THEMES.retro.palette[0].hex);
    check('an unknown theme falls back rather than throwing', paletteOf('nonsense').length === 8);
}

console.log('\nretro — the values sampled from therange.fyi:');
{
    const v = THEMES.retro.cssVars;
    check('ground is the blue-grey', v['--bg-main'] === '#b1c3d0', v['--bg-main']);
    check('cards are cream', v['--bg-panel'] === '#ece0d4', v['--bg-panel']);
    check('ink is espresso', v['--text-main'] === '#372420', v['--text-main']);
    check('the accent is cobalt', v['--accent-gold'] === '#1e50d2', v['--accent-gold']);
    check('borders are ink, not a tint', v['--border-gold'] === '#372420', v['--border-gold']);
    check('the shadow is a hard offset, not a blur',
        !/blur|rgba/.test(THEME_CHARACTER.retro['--shadow-md'])
        && /^\d+px \d+px 0 /.test(THEME_CHARACTER.retro['--shadow-md']),
        THEME_CHARACTER.retro['--shadow-md']);
    check('its fonts are imported', THEMES.retro.fontImports.includes('Archivo Black'));
}

console.log('\nfont imports are actually fetched:');
{
    const css = fs.readFileSync('src/index.css', 'utf8');
    for (const id of ids) {
        const missing = THEMES[id].fontImports.filter((f) => !css.includes(f.replace(/ /g, '+')));
        check(`${id}`, missing.length === 0, `not in the Google Fonts import: ${missing.join(', ')}`);
    }
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
