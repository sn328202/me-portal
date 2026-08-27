/**
 * Google Maps styling derived from the active theme.
 *
 * The first version hardcoded a dark palette. That was right for Dark Academia
 * and wrong the moment a light theme became the default — a black rectangle in
 * a white app. Reading the theme's own CSS variables means the map is made of
 * whatever the palette currently is, including themes that do not exist yet.
 *
 * Plain .js rather than living inside the component so the colour maths can be
 * tested; getting the light/dark decision backwards is the whole risk here and
 * it is invisible until someone looks at a screen.
 */

const HEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

const parseHex = (hex) => {
    const m = HEX.exec(String(hex || '').trim());
    return m ? m.slice(1).map((h) => parseInt(h, 16)) : null;
};

/** Perceived lightness, 0–1. Above 0.5 is a light surface. */
export const luminance = (hex) => {
    const rgb = parseHex(hex);
    if (!rgb) return 0;
    const [r, g, b] = rgb.map((c) => c / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const isLight = (hex) => luminance(hex) >= 0.5;

/** Blend two hex colours. weight 0 returns `a`, weight 1 returns `b`. */
export const mix = (a, b, weight = 0.5) => {
    const x = parseHex(a);
    const y = parseHex(b);
    if (!x || !y) return a;
    const w = Math.min(1, Math.max(0, weight));
    return `#${x.map((c, i) => Math.round(c * (1 - w) + y[i] * w).toString(16).padStart(2, '0')).join('')}`;
};

/** Read a CSS custom property off the live document. */
export const readToken = (name, fallback) => {
    if (typeof window === 'undefined' || !window.getComputedStyle) return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
};

/**
 * Build the Maps style array from a palette. Takes the colours as an argument
 * rather than reading them itself, so it can be exercised without a browser.
 */
export const buildMapStyle = ({ ground, panel, text }) => {
    // Water reads as water by being pushed away from the ground colour —
    // darker on a dark map, lighter on a light one.
    const water = mix(ground, isLight(ground) ? '#ffffff' : '#000000', 0.35);

    return [
        { elementType: 'geometry', stylers: [{ color: ground }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: ground }] },
        { elementType: 'labels.text.fill', stylers: [{ color: text }] },
        // Google's own points of interest compete with her pins, which are the
        // entire subject of this map.
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: panel }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: text }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: water }] },
        { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: mix(ground, panel, 0.5) }] },
    ];
};

/** The live palette, read off the document. */
export const currentPalette = () => ({
    ground: readToken('--bg-main', '#201620'),
    panel: readToken('--bg-panel', '#2b1f2a'),
    text: readToken('--text-muted', '#bda6a4'),
});

/** Pin colours, also from the theme, so they stay legible on whatever ground. */
export const pinColours = () => ({
    restaurant: readToken('--accent-crimson', '#dc8b95'),
    bar: readToken('--border-gold', '#b07c69'),
    cafe: readToken('--text-gold', '#d9a37c'),
    museum: readToken('--text-highlight', '#9d8ec4'),
    park: readToken('--accent-green', '#7ba37b'),
    hike: readToken('--accent-green', '#7ba37b'),
    shop: readToken('--fill-strong', '#d4a5c4'),
    venue: readToken('--accent-gold', '#c4a05a'),
});
