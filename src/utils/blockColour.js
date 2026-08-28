/**
 * What colour a plan wears on the timeline.
 *
 * Colouring by kind was the whole story until now — food one shade, transport
 * another — which answers "what sort of thing is this" and nothing else. But
 * the questions people actually ask a week grid are "which of these is the
 * thing we booked" and "which of these are the same trip out", and neither is
 * a kind.
 *
 * So a plan can carry its own colour, and it is stored as a *number* rather
 * than a hex value: 1–8, pointing at --c-1 … --c-8, the eight hues each theme
 * declares for itself. A block painted under Studio therefore repaints itself
 * when the vibe changes to eight-bit, instead of sitting there as a stray
 * brown in a room full of neon.
 *
 * Pure, so the arithmetic that picks readable ink can be tested without a
 * browser — the sort that looks right and is off by a channel.
 */

import { contrast } from './wardrobeTheme.js';

/** The hues on offer, by number. */
export const HUES = [1, 2, 3, 4, 5, 6, 7, 8];

export const hueVar = (n) => `--c-${n}`;

/**
 * Which of two inks reads on a fill.
 *
 * Not "is the fill light?" — eight-bit's hues include #ffff00, and a lightness
 * threshold writes white on it. Asking which of the theme's own two inks
 * actually stands out gives the answer a person would give.
 */
export const inkOn = (fill, panel, main) => {
    const onPanel = contrast(fill, panel);
    const onMain = contrast(fill, main);
    // Neither is readable because the fill is not a colour at all. Panel on
    // panel would be invisible, so the ordinary ink is the safer guess.
    if (!onPanel && !onMain) return main;
    return onPanel >= onMain ? panel : main;
};

/**
 * The eight hues as the current theme has them, each with its readable ink.
 * `read` takes a variable name and returns its computed value.
 */
export const blockPalette = (read) => {
    const value = (name) => String(read(name) || '').trim();
    const panel = value('--bg-panel');
    const main = value('--text-main');

    return HUES.map((n) => {
        const fill = value(hueVar(n));
        return { n, fill, ink: fill ? inkOn(fill, panel, main) : main };
    });
};

/**
 * The inline style a plan wears, or nothing at all.
 *
 * Nothing at all matters: a plan with no colour of its own must fall back to
 * the stylesheet's rule for its kind, and an inline `background: undefined`
 * would not do that — it has to be absent.
 */
export const blockStyle = (item, palette = []) => {
    const n = Number(item?.colour);
    if (!Number.isInteger(n) || n < 1 || n > 8) return null;

    const hue = palette[n - 1];
    if (!hue?.fill) return null;
    return { background: hue.fill, color: hue.ink };
};
