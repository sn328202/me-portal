/**
 * The Wardrobe, wearing the same clothes as everything else.
 *
 * The outfit planner is a standalone HTML file in /public, embedded in an
 * iframe, with its own hand-picked palette baked in — an off-white room, white
 * cards, one soft brown accent. That palette is where the Studio theme came
 * from, so under Studio the seam is invisible. Under any of the other twelve
 * it is a bright rectangle sitting inside a dark room.
 *
 * The fix is not to restyle it twice. The iframe is same-origin, so the portal
 * can read its own theme tokens off :root and hand them across as the planner's
 * dozen variables. One palette, two documents.
 *
 * Everything here is pure so the mapping can be tested without a browser: the
 * colour arithmetic below is exactly the sort that looks right and is off by a
 * channel.
 */

/* The planner's variables, and which portal token each is really asking for. */
export const TOKEN_MAP = {
    '--bg': '--bg-main',
    '--card': '--bg-panel',
    '--ink': '--text-main',
    '--muted': '--text-muted',
    '--line': '--border-dim',
    '--accent': '--text-gold',
    '--accent-soft': '--accent-gold-dim',
    '--good': '--accent-green',
    '--warn': '--accent-gold',
    '--danger': '--accent-crimson',
    '--r': '--radius-lg',
    '--shadow': '--glow-gold',
    '--font-ui': '--font-body',
    '--font-title': '--font-display',
    /* How this theme sets a heading. Eleven of the thirteen set their own
       tracking and six shout their titles, so the planner's header has to be
       told rather than guessing — otherwise it is the one heading in the app
       not speaking in the room's voice.

       Weight is not here: every theme uses the same 700, so it is a constant
       rather than a thing to hand across, and the test below is right to
       refuse a token no theme defines. */
    '--case-title': '--case-heading',
    '--tracking-title': '--tracking-heading',
};

const hex = (value) => {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || '').trim());
    if (!m) return null;
    const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/** Perceived lightness, 0–1. Not the average: green reads far brighter than blue. */
export const luminance = (value) => {
    const rgb = hex(value);
    if (!rgb) return null;
    const [r, g, b] = rgb.map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Hue in degrees, or null for a grey — a grey has no hue to be nearest to. */
export const hueOf = (value) => {
    const rgb = hex(value);
    if (!rgb) return null;
    const [r, g, b] = rgb.map((c) => c / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d < 0.02) return null;

    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;

    return ((h * 60) % 360 + 360) % 360;
};

/**
 * WCAG contrast ratio, 1 (identical) to 21 (black on white).
 *
 * Needed because "is the accent light?" is the wrong question. Eight-bit's
 * accent is #ffff00 and its ink is #ffffff: a lightness threshold picks the
 * ink and writes white on yellow. Asking which of two colours actually stands
 * out against it gives black, which is the answer a person would give.
 */
export const contrast = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    if (la === null || lb === null) return 0;
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** How far apart two hues are on the wheel, the short way round. */
const arc = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
};

/**
 * The hue in a palette nearest a target.
 *
 * The weather pills need a cold and a hot, and no theme token is either — the
 * tokens are gold, green and crimson. But every theme carries eight named hues
 * as --c-1…--c-8, and one of them is always the bluest. Picking from those keeps
 * the pills inside the theme's own palette instead of importing a stray blue.
 */
export const nearestHue = (colours = [], target = 210) => {
    const scored = colours
        .map((c) => ({ c, h: hueOf(c) }))
        .filter((x) => x.h !== null);
    if (!scored.length) return null;
    return scored.sort((a, b) => arc(a.h, target) - arc(b.h, target))[0].c;
};

/**
 * The planner's stylesheet, built from whatever the portal's :root currently
 * says. `read` takes a variable name and returns its computed value.
 */
export const wardrobeVars = (read) => {
    const value = (name) => String(read(name) || '').trim();

    const vars = {};
    for (const [target, source] of Object.entries(TOKEN_MAP)) {
        const v = value(source);
        if (v) vars[target] = v;
    }

    const palette = Array.from({ length: 8 }, (_, i) => value(`--c-${i + 1}`)).filter(Boolean);
    const cold = nearestHue(palette, 210);
    const hot = nearestHue(palette, 20);
    if (cold) vars['--cold'] = cold;
    if (hot) vars['--hot'] = hot;

    // What to write *on* the accent: whichever of the theme's own ink and its
    // room colour actually stands out against it. Both are already in the
    // palette, so the button never imports a colour from nowhere.
    const accent = vars['--accent'];
    const candidates = [vars['--ink'], vars['--bg'], '#ffffff', '#000000'].filter(Boolean);
    if (accent && candidates.length) {
        vars['--on-accent'] = candidates
            .sort((a, b) => contrast(accent, b) - contrast(accent, a))[0];
    }

    return vars;
};

/** Those variables as a stylesheet the iframe can be handed. */
export const wardrobeCss = (read) => {
    const vars = wardrobeVars(read);
    const body = Object.entries(vars).map(([k, v]) => `${k}:${v};`).join('');
    if (!body) return '';

    const dark = (luminance(vars['--bg']) ?? 1) < 0.4;
    // Native checkboxes, date pickers and scrollbars are painted by the browser
    // and ignore every variable above; color-scheme is the only lever on them.
    return `:root{${body}color-scheme:${dark ? 'dark' : 'light'};}`;
};
