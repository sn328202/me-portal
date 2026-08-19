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

The aesthetic's own sources are consistent: deep browns, forest green,
burgundy/oxblood, navy, and ivory/cream, with **brass as an accent**, and a
chiaroscuro contrast between candlelight and shadow. The reference points are
Gothic and Neoclassical interiors — mahogany panelling, wrought iron, leather
bindings, rusticated stone.

The original theme was near-black `#0c0a09` plus a saturated yellow gold
`#cfb53b`, and that gold was assigned to every role at once: headings, borders,
buttons, corner ornaments, values and active states. Two colours doing
everything reads as goth or arcade, not as a library.

What it is now:

| role | value | why |
|---|---|---|
| ground | `#171310` | bistre, not black — the room is made of something |
| panel | `#201a15` | walnut, lifted so cards read as objects on a surface |
| text | `#ece2d2` | parchment, warm — cream is core to the palette |
| brass | `#c9a961` | antique brass, desaturated from the old yellow gold |
| oxblood | `#7b2d3a` (`--fill-strong`) | structural fill; 7.19:1 under parchment |
| moss | `#3f5b45` (`--fill-quiet`) | the forest green the palette calls for |

And brass now has a job rather than every job: headings take
`--text-heading` (parchment), while brass is reserved for accent, value,
active state and the corner ornaments — which dropped to `0.38` opacity so
they read as a glint rather than a gilt frame.

Every text token clears 4.5:1 and every border 3:1 against both the page and
the panel. `node scripts/shots.mjs --themes dark-academia` re-renders it.

Sources: [Aesthetics Wiki](https://aesthetics.fandom.com/wiki/Dark_Academia) ·
[97 Decor palette guide](https://97decor.com/blogs/news/dark-academia-color-palette-a-complete-guide-to-aesthetic-color-combinations)
