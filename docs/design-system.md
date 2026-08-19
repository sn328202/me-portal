# Me Portal design system

Everything visual is built from three files and nine primitives. If you are
adding UI, reach for these before writing a `style={{}}`.

## Where things live

| | |
|---|---|
| `src/styles/tokens.css` | spacing, type, shape, depth, motion, density scales |
| `src/styles/theme.css` | palette, font families, base element styling |
| `src/styles/primitives.css` | the component classes |
| `src/configs/themes.jsx` | the 7 skins: `cssVars` (palette) + `THEME_CHARACTER` (body language) |
| `src/components/ui/` | the React primitives |

## Scales — use the token, never the literal

**Spacing** `--space-1` 4px · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 24 · `-6` 32 · `-7` 48 · `-8` 64.
The old `--space-xs/sm/md/lg/xl` aliases still resolve; new work uses numbers.

**Type** `--text-2xs` 11px · `xs` 12 · `sm` 14 · `base` 16 · `lg` 18 · `xl` 22 ·
`2xl` 28 · `3xl` 36 · `4xl` 48 · `5xl` 64.
There is no size between `sm` and `base`. If you want one, you want `sm`.

**Everything else** `--radius-sm/md/lg/pill`, `--shadow-sm/md/lift`,
`--dur-fast/base/slow`, `--ease`, `--ease-out`, `--lift`, `--density`.

## Rules and ornament

`--rule` is the app's signature border — a 3px Victorian double rule on the
Victorian skins, a hard 3px solid on 8-Bit, a hairline on the rest. Never
write `3px double` or `1px solid var(--border-gold)` directly; use `--rule`,
`--rule-accent` (1px gold) or `--rule-hair` (1px dim).

Corner brackets on cards are controlled by `--ornament-opacity`, which is 0
on the non-Victorian skins. Don't add your own corners.

## Case and tracking

`--case-heading` is `uppercase` on most skins and `none` on Cottagecore and
Lofi — Cottagecore's display face is handwriting, and you never uppercase
handwriting. Use `text-transform: var(--case-heading)` on headings rather
than hardcoding `uppercase`, and `letter-spacing: var(--tracking-heading)`.

## Primitives

```jsx
import { Button, Card, PageHeader, Tabs, TabPanel, Modal, Field, Tag, Stat, ConfirmButton, EmptyState } from '../components/ui';
```

| | |
|---|---|
| `<Button variant icon label size block>` | `default` / `primary` / `solid` / `ghost` / `danger`. `icon` needs `label` — it becomes the accessible name. |
| `<Card title icon actions variant interactive scroll>` | `raised` (double rule + brackets) or `flat` (hairline, for nested surfaces and list rows). |
| `<PageHeader title icon subtitle actions>` | One per page. Replaces seven hand-rolled headers. |
| `<Tabs tabs active onChange variant>` | `underline` switches content; `segmented` switches how the same content is shown. Arrow keys work. |
| `<Modal open onClose title footer size>` | Real dialog: focus trap, focus restore, Escape, backdrop click, scroll lock. |
| `<Field label hint error as>` | Label wired to control with a generated id. |
| `<Tag tone icon>` · `<Stat value label icon>` | `default` / `gold` / `green` / `red`. |
| `<ConfirmButton onConfirm label confirmLabel>` | Two-click destructive with a 3s reset. Keep the room's voice in `confirmLabel`. |
| `<EmptyState message hint actionLabel onAction icon>` | The voice stays per-room; only the frame is shared. |

Utility classes: `.page` `.stack` `.row` `.row--wrap` `.spacer` `.muted`
`.section-title` `.field-row` `.tag-list` `.stat-row` `.visually-hidden`
`.prose` `.spin`.

## Rules of thumb

1. **No new inline `style={{}}` for spacing, colour, type or borders.** Layout
   one-offs (a grid template, an aspect ratio) are fine.
2. **Icon-only buttons need `label`.** No exceptions — the app shipped ~15
   buttons that announced as "button".
3. **Every list needs an empty state**, and it should sound like the room.
4. **Destructive actions use `ConfirmButton`**, never `window.confirm`.
5. **Card list heights** come from `scroll` / `scroll="tall"`, not a
   hand-picked pixel height. Cards in a row should line up.

## Dark Academia — what the palette is doing

The aesthetic's sources are consistent: deep browns, forest green,
burgundy/oxblood, ivory and cream, with chiaroscuro between candlelight and
shadow. But they also describe it as *romantic* — Pre-Raphaelite, velvet,
wine, firelight — and a first pass that reads the sources as "brown plus
brass" lands somewhere colder and more austere than the aesthetic actually
is. Brass is a real part of the palette; it just should not be the loudest
thing in the room.

The original theme was near-black `#0c0a09` plus saturated yellow gold
`#cfb53b`, with that gold assigned to every role at once — headings,
borders, buttons, ornaments, values, active states. Measured by hue, its
accent (42°), border (41°) and muted text (36°) all sat in the khaki band,
which is precisely what made it read as "yellow and dark brown".

Where it landed:

| role | value | hue | why |
|---|---|---|---|
| ground | `#201620` | plum-cocoa | lifted out of near-black; velvet, not ink |
| panel | `#2b1f2a` | — | a clear step above the page, so cards are objects on a surface |
| text | `#f2e6de` | 21° | warm ivory with a pink bias |
| metal | `#d9a37c` | 24° | **copper, not brass** — the single change that removes the yellow |
| rose | `#dc8b95` | 352° | antique rose for accents and destructive states |
| burgundy | `#71263c` (`--fill-strong`) | 342° | structural fill; 8.39:1 under parchment |
| sage | `#4f5d4d` (`--fill-quiet`) | — | the palette's green, kept quiet |

**No token sits between hue 40 and 70** — the khaki band is empty by
construction, and that is the property to preserve if this ever gets
adjusted again.

Brass/copper also has one job rather than all of them: headings take
`--text-heading` (parchment), and the metal is reserved for accent, value,
active state and the corner ornaments, which sit at `0.38` opacity.

The background is a pair of very low-opacity radial washes — candlelight
falling into the room from the top left, wine pooling bottom right — rather
than the previous `feTurbulence` fractal-noise SVG, which rendered as a
visible grey speckle over everything.

Every text token clears 4.5:1 and every border 3:1 against both the page and
the panel. `node scripts/shots.mjs --themes dark-academia` re-renders it.

Sources: [Aesthetics Wiki](https://aesthetics.fandom.com/wiki/Dark_Academia) ·
[97 Decor palette guide](https://97decor.com/blogs/news/dark-academia-color-palette-a-complete-guide-to-aesthetic-color-combinations)
