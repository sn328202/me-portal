/**
 * The map's colour maths.
 *
 * The bug this replaces: a hardcoded dark map, which looked right in Dark
 * Academia and became a black rectangle in a white app the moment a light
 * theme became the default. Getting the light/dark decision backwards is
 * invisible until someone opens the page, so it is pinned here.
 */
import { luminance, isLight, mix, buildMapStyle } from '../src/utils/mapStyle.js';

let failed = 0;
const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
};

// The two real palettes in the app right now.
const DARK_ACADEMIA = { ground: '#201620', panel: '#2b1f2a', text: '#bda6a4' };
const STUDIO = { ground: '#f6f5f3', panel: '#ffffff', text: '#8a847b' };

console.log('\nluminance() / isLight():');
check('Dark Academia ground is dark', isLight(DARK_ACADEMIA.ground), false);
check('Studio ground is light', isLight(STUDIO.ground), true);
check('pure black', isLight('#000000'), false);
check('pure white', isLight('#ffffff'), true);
check('a mid grey lands on the light side', isLight('#808080'), true);
check('junk is treated as dark rather than throwing', isLight('not a colour'), false);

console.log('\nmix():');
check('halfway between black and white', mix('#000000', '#ffffff', 0.5), '#808080');
check('weight 0 keeps the first', mix('#123456', '#ffffff', 0), '#123456');
check('weight 1 becomes the second', mix('#123456', '#ffffff', 1), '#ffffff');
check('out-of-range weight is clamped', mix('#000000', '#ffffff', 5), '#ffffff');
check('junk falls back to the first', mix('nope', '#ffffff', 0.5), 'nope');

console.log('\nbuildMapStyle() — water must contrast with the ground either way:');
{
    const water = (palette) => buildMapStyle(palette)
        .find((r) => r.featureType === 'water').stylers[0].color;

    const darkWater = water(DARK_ACADEMIA);
    const lightWater = water(STUDIO);

    check('on a dark map, water is darker than the ground',
        luminance(darkWater) < luminance(DARK_ACADEMIA.ground), true);
    check('on a light map, water is lighter than the ground',
        luminance(lightWater) > luminance(STUDIO.ground), true);
}
{
    const style = buildMapStyle(STUDIO);
    check('ground comes from the theme', style[0].stylers[0].color, STUDIO.ground);
    check('roads come from the panel colour',
        style.find((r) => r.featureType === 'road' && r.elementType === 'geometry').stylers[0].color,
        STUDIO.panel);
    check("Google's own pins stay hidden",
        style.find((r) => r.featureType === 'poi').stylers[0].visibility, 'off');
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
