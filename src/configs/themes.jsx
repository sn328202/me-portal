import React from 'react';
import {
    GiBasket, GiJeweledChalice, GiCauldron, GiScrollUnfurled, GiCrossedSwords,
    GiChest, GiPotionBall, GiSwordman, GiGamepad, GiConsoleController,
    GiSprout, GiFlowerPot, GiCookingPot, GiField, GiButterfly,
    GiSteampunkGoggles, GiCircuitry, GiClick, GiServerRack, GiCyberEye,
    GiKeyboard, GiSpatter, GiHand, GiShield, GiBroadsword, GiAnkh,
    GiWaxSeal, GiControlTower,
    // Lofi
    GiCoffeeBeans, GiCompactDisc, GiMoon, GiSofa, GiCoffeeCup, GiQuill, GiMusicalNotes,
    // Renaissance
    GiBreadSlice, GiImperialCrown, GiHarp, GiTrumpetFlag,
    // Cybercity
    GiRobotGrab, GiLightningHelix, GiVrHeadset, GiMechanicalArm, GiWalkieTalkie, GiSatelliteCommunication
} from 'react-icons/gi';

export const THEMES = {
    'dark-academia': {
        name: 'Dark Academia',
        id: 'dark-academia',
        fontImports: ['Playfair Display', 'Inter', 'Courier Prime'],
        cssVars: {
            /* Candlelit library: walnut and bistre ground, parchment,
               antique brass. Dark academia's palette is browns, oxblood,
               forest and cream with brass as an accent — not black and
               yellow gold, which is what this was. */
            '--bg-main': '#171310',
            '--bg-panel': '#201a15',
            '--bg-hover': '#2c241c',
            '--bg-main-rgb': '23, 19, 16',
            '--text-main': '#ece2d2',
            '--text-muted': '#a4957f',
            '--text-dim': '#c0b29a',
            '--text-gold': '#c9a961',
            '--text-highlight': '#e9d4a0',
            '--accent-crimson': '#c4757a',
            '--accent-red': '#d97a7a',
            '--accent-green': '#8aa87f',
            '--accent-gold': '#c9a961',
            '--accent-gold-dim': 'rgba(201, 169, 97, 0.16)',
            '--border-gold': '#8c7645',
            '--border-bright': '#c9a961',
            '--border-dim': '#776a58',
            '--active-border': '#c9a961',
            '--fill-strong': '#7b2d3a',
            '--fill-quiet': '#3f5b45',
            '--font-display': "'Playfair Display', serif",
            '--font-body': "'Inter', sans-serif",
            '--font-mono': "'Courier Prime', monospace",
            '--font-serif': "'Cormorant Garamond', Georgia, serif",
            '--radius-lg': '8px',
            '--glass-panel': 'rgba(32, 26, 21, 0.95)',
            '--glow-gold': '0 0 12px rgba(201, 169, 97, 0.18)',
            '--bg-texture': 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.07\'/%3E%3C/svg%3E")'
                },
        labels: {
            provisions: 'Provisions',
            larderEmpty: 'The larder is empty.',
            fromTheHearth: 'From The Hearth',
            greetingDefault: 'Traveler',
            goals: 'Aspirations',
            habits: 'Rituals',
            hobbies: 'Pursuits',
            library: 'Archives',
            todos: 'Agendas',
            chores: 'Duty',
            social: 'Register',
            status: 'Observatory',
            statusConfig: 'Calibrate Lens',
            statusEstablish: 'Align Stars',
            nowConsuming: 'Now Examining'
        },
        icons: {
            provisions: <GiBasket />,
            goals: <GiScrollUnfurled />,
            habits: <GiJeweledChalice />,
            hobbies: <GiCauldron />,
            games: <GiCrossedSwords />,
            library: <GiScrollUnfurled />,
            todos: <GiScrollUnfurled />,
            chores: <GiAnkh />,
            social: <GiWaxSeal />,
            status: <GiControlTower />
        }
    },
    'eight-bit': {
        name: '8-Bit Arcade',
        id: 'eight-bit',
        fontImports: ['Press Start 2P'],
        cssVars: {
            '--bg-main': '#000000',
            '--bg-panel': '#222222',
            '--bg-hover': '#444444',
            '--bg-main-rgb': '0, 0, 0',
            '--text-main': '#ffffff',
            '--text-muted': '#aaaaaa',
            '--text-dim': '#898989',
            '--text-gold': '#ffff00',
            '--text-highlight': '#00ffff',
            '--accent-crimson': '#ff5555',
            '--accent-red': '#ff5555',
            '--accent-green': '#00ff00',
            '--accent-gold': '#ffff00',
            '--accent-gold-dim': 'rgba(255, 255, 0, 0.18)',
            '--border-gold': '#ffffff',
            '--border-bright': '#ffffff',
            '--border-dim': '#888888',
            '--active-border': '#ffff00',
            '--font-display': "'Press Start 2P', system-ui",
            '--font-body': "'Press Start 2P', system-ui",
            '--font-mono': "'Press Start 2P', system-ui",
            '--font-serif': "'Press Start 2P', system-ui",
            '--radius-lg': '0px',
            '--glass-panel': 'rgba(34, 34, 34, 0.95)',
            '--glow-gold': '0 0 10px rgba(255, 255, 0, 0.2)',
            '--bg-texture': 'none'
        },
        labels: {
            provisions: 'Inventory',
            larderEmpty: 'Empty Inventory',
            fromTheHearth: 'Crafting Items',
            greetingDefault: 'Player 1',
            goals: 'Quests',
            habits: 'Daily XP',
            hobbies: 'Side Quests',
            library: 'Bestiary',
            todos: 'To-Do List',
            chores: 'Missions',
            social: 'Multiplayer',
            status: 'Mini-Map',
            statusConfig: 'Options',
            statusEstablish: 'Sync',
            nowConsuming: 'Equipped'
        },
        icons: {
            provisions: <GiChest />,
            goals: <GiGamepad />,
            habits: <GiPotionBall />,
            hobbies: <GiSwordman />,
            games: <GiConsoleController />,
            library: <GiScrollUnfurled />,
            todos: <GiKeyboard />,
            chores: <GiShield />,
            social: <GiConsoleController />,
            status: <GiSpatter />
        }
    },
    'cottagecore': {
        name: 'Cottagecore',
        id: 'cottagecore',
        fontImports: ['Loved by the King', 'Crimson Text', 'Courier Prime'],
        cssVars: {
            '--bg-main': '#fdf6e3',
            '--bg-panel': '#fff9eb',
            '--bg-hover': '#f5ecce',
            '--bg-main-rgb': '253, 246, 227',
            '--text-main': '#5c4b37',
            '--text-muted': '#6f6152',
            '--text-dim': '#7d6e5e',
            '--text-gold': '#5f6b3c',
            '--text-highlight': '#8a6449',
            '--accent-crimson': '#a84a4a',
            '--accent-red': '#a3352f',
            '--accent-green': '#41663a',
            '--accent-gold': '#7a6620',
            '--accent-gold-dim': 'rgba(122, 102, 32, 0.18)',
            '--border-gold': '#a08a5e',
            '--border-bright': '#6b5c3f',
            '--border-dim': '#a2865c',
            '--active-border': '#6b5c3f',
            '--font-display': "'Loved by the King', cursive",
            '--font-body': "'Crimson Text', serif",
            '--font-mono': "'Courier Prime', monospace",
            '--font-serif': "'Crimson Text', Georgia, serif",
            '--radius-lg': '16px',
            '--glass-panel': 'rgba(255, 249, 235, 0.95)',
            '--glow-gold': '0 0 10px rgba(122, 102, 32, 0.25)',
            '--bg-texture': "url('https://www.transparenttextures.com/patterns/natural-paper.png')"
        },
        labels: {
            provisions: 'Pantry',
            larderEmpty: 'Checking the cupboards...',
            fromTheHearth: 'Garden Harvest',
            greetingDefault: 'Dear Friend',
            goals: 'Little Dreams',
            habits: 'Gentle Beats',
            hobbies: 'Creative Hours',
            library: 'Bookshelf',
            todos: 'Daily Notes',
            chores: 'Tidying',
            social: 'Company',
            status: 'Window View',
            statusConfig: 'Adjust Curtains',
            statusEstablish: 'Open Sash',
            nowConsuming: 'Cozy Reading'
        },
        icons: {
            provisions: <GiFlowerPot />,
            goals: <GiButterfly />,
            habits: <GiSprout />,
            hobbies: <GiCookingPot />,
            games: <GiField />,
            library: <GiFlowerPot />,
            todos: <GiHand />,
            chores: <GiFlowerPot />,
            social: <GiButterfly />,
            status: <GiField />
        }
    },
    'matrix': {
        name: 'The Matrix',
        id: 'matrix',
        fontImports: ['VT323'],
        cssVars: {
            '--bg-main': '#000000',
            '--bg-panel': '#001100',
            '--bg-hover': '#002200',
            '--bg-main-rgb': '0, 0, 0',
            '--text-main': '#00ff00',
            '--text-muted': '#00b300',
            '--text-dim': '#009a00',
            '--text-gold': '#00ff00',
            '--text-highlight': '#ffffff',
            '--accent-crimson': '#22ff22',
            '--accent-red': '#ff5f5f',
            '--accent-green': '#00ff00',
            '--accent-gold': '#00ff00',
            '--accent-gold-dim': 'rgba(0, 255, 0, 0.18)',
            '--border-gold': '#00ff00',
            '--border-bright': '#66ff66',
            '--border-dim': '#008f00',
            '--active-border': '#66ff66',
            '--font-display': "'VT323', monospace",
            '--font-body': "'VT323', monospace",
            '--font-mono': "'VT323', monospace",
            '--font-serif': "'VT323', monospace",
            '--radius-lg': '0px',
            '--glass-panel': 'rgba(0, 17, 0, 0.95)',
            '--glow-gold': '0 0 10px rgba(0, 255, 0, 0.25)',
            '--bg-texture': 'none'
        },
        labels: {
            provisions: 'Data Packets',
            larderEmpty: 'Null Pointer Exception',
            fromTheHearth: 'Source Code',
            greetingDefault: 'Neo',
            goals: 'Directives',
            habits: 'Loops',
            hobbies: 'Sub-routines',
            library: 'Databanks',
            todos: 'Tasks',
            chores: 'Maintenance',
            social: 'Network',
            status: 'Command Line',
            statusConfig: 'Init Request',
            statusEstablish: 'Jack In',
            nowConsuming: 'Parsing'
        },
        icons: {
            provisions: <GiServerRack />,
            goals: <GiClick />,
            habits: <GiCircuitry />,
            hobbies: <GiCyberEye />,
            games: <GiSteampunkGoggles />,
            library: <GiServerRack />,
            todos: <GiServerRack />,
            chores: <GiSteampunkGoggles />,
            social: <GiClick />,
            status: <GiCyberEye />
        }
    },
    'lofi': {
        name: 'Lofi Study',
        id: 'lofi',
        fontImports: ['Comfortaa', 'Quicksand', 'Courier Prime'],
        cssVars: {
            '--bg-main': '#1a1b26',
            '--bg-panel': '#24283b',
            '--bg-hover': '#2f3549',
            '--bg-main-rgb': '26, 27, 38',
            '--text-main': '#a9b1d6',
            '--text-muted': '#969dc1',
            '--text-dim': '#858db7',
            '--text-gold': '#bb9af7',
            '--text-highlight': '#7aa2f7',
            '--accent-crimson': '#f7768e',
            '--accent-red': '#f7768e',
            '--accent-green': '#9ece6a',
            '--accent-gold': '#bb9af7',
            '--accent-gold-dim': 'rgba(187, 154, 247, 0.18)',
            '--border-gold': '#6f79a8',
            '--border-bright': '#bb9af7',
            '--border-dim': '#69739f',
            '--active-border': '#bb9af7',
            '--font-display': "'Comfortaa', cursive",
            '--font-body': "'Quicksand', sans-serif",
            '--font-mono': "'Courier Prime', monospace",
            '--font-serif': "'Quicksand', sans-serif",
            '--radius-lg': '20px',
            '--glass-panel': 'rgba(36, 40, 59, 0.95)',
            '--glow-gold': '0 0 10px rgba(187, 154, 247, 0.25)',
            '--bg-texture': 'none'
        },
        labels: {
            provisions: 'Essentials',
            larderEmpty: 'Restocking the vibes...',
            fromTheHearth: 'Chill Beats',
            greetingDefault: 'Friend',
            goals: 'Chill Dreams',
            habits: 'Vibes',
            hobbies: 'Side Quests',
            library: 'Vinyls',
            todos: 'Notes',
            chores: 'Tidying',
            social: 'Hangouts',
            status: 'Lo-fi Radio',
            statusConfig: 'Change Station',
            statusEstablish: 'Tune In',
            nowConsuming: 'Vibing'
        },
        icons: {
            provisions: <GiCoffeeBeans />,
            goals: <GiMoon />,
            habits: <GiMusicalNotes />,
            hobbies: <GiSofa />,
            games: <GiGamepad />,
            library: <GiCompactDisc />,
            todos: <GiQuill />,
            chores: <GiFlowerPot />,
            social: <GiCoffeeCup />,
            status: <GiCompactDisc />
        }
    },
    'renaissance': {
        name: 'Renaissance',
        id: 'renaissance',
        fontImports: ['Cinzel', 'Cormorant Garamond', 'Courier Prime'],
        cssVars: {
            '--bg-main': '#0e1111',
            '--bg-panel': '#1a1c1c',
            '--bg-hover': '#2a2d2d',
            '--bg-main-rgb': '14, 17, 17',
            '--text-main': '#d4af37',
            '--text-muted': '#9a9d9d',
            '--text-dim': '#818484',
            '--text-gold': '#ffd700',
            '--text-highlight': '#ffffff',
            '--accent-crimson': '#cf6a6a',
            '--accent-red': '#d46a6a',
            '--accent-green': '#6f9c7a',
            '--accent-gold': '#d4af37',
            '--accent-gold-dim': 'rgba(212, 175, 55, 0.18)',
            '--border-gold': '#d4af37',
            '--border-bright': '#ffd700',
            '--border-dim': '#6a6d6d',
            '--active-border': '#ffd700',
            '--font-display': "'Cinzel', serif",
            '--font-body': "'Cormorant Garamond', serif",
            '--font-mono': "'Courier Prime', monospace",
            '--font-serif': "'Cormorant Garamond', Georgia, serif",
            '--radius-lg': '4px',
            '--glass-panel': 'rgba(26, 28, 28, 0.95)',
            '--glow-gold': '0 0 10px rgba(212, 175, 55, 0.25)',
            '--bg-texture': 'url("https://www.transparenttextures.com/patterns/natural-paper.png")'
        },
        labels: {
            provisions: 'Victuals',
            larderEmpty: 'The cellar is bare.',
            fromTheHearth: 'Artisan Works',
            greetingDefault: 'Noble',
            goals: 'Legacies',
            habits: 'Practices',
            hobbies: 'Mastery',
            library: 'Scriptorium',
            todos: 'Decrees',
            chores: 'Labor',
            social: 'Courts',
            status: 'Heraldry',
            statusConfig: 'Ink Scroll',
            statusEstablish: 'Seal Decree',
            nowConsuming: 'Studying'
        },
        icons: {
            provisions: <GiBreadSlice />,
            goals: <GiImperialCrown />,
            habits: <GiHarp />,
            hobbies: <GiImperialCrown />,
            games: <GiCrossedSwords />,
            library: <GiScrollUnfurled />,
            todos: <GiQuill />,
            chores: <GiAnkh />,
            social: <GiTrumpetFlag />,
            status: <GiImperialCrown />
        }
    },
    'cybercity': {
        name: 'Cybercity',
        id: 'cybercity',
        fontImports: ['Orbitron', 'Michroma', 'Courier Prime'],
        cssVars: {
            '--bg-main': '#050505',
            '--bg-panel': '#0d0d0d',
            '--bg-hover': '#1a1a1a',
            '--bg-main-rgb': '5, 5, 5',
            '--text-main': '#00f3ff',
            '--text-muted': '#a15cff',
            '--text-dim': '#994eff',
            '--text-gold': '#ff00ae',
            '--text-highlight': '#ffffff',
            '--accent-crimson': '#ff003c',
            '--accent-red': '#ff3860',
            '--accent-green': '#00ff9f',
            '--accent-gold': '#ff00ae',
            '--accent-gold-dim': 'rgba(255, 0, 174, 0.18)',
            '--border-gold': '#00f3ff',
            '--border-bright': '#00f3ff',
            '--border-dim': '#00868c',
            '--active-border': '#00f3ff',
            '--font-display': "'Orbitron', sans-serif",
            '--font-body': "'Michroma', sans-serif",
            '--font-mono': "'Courier Prime', monospace",
            '--font-serif': "'Michroma', sans-serif",
            '--radius-lg': '0px',
            '--glass-panel': 'rgba(13, 13, 13, 0.95)',
            '--glow-gold': '0 0 10px rgba(255, 0, 174, 0.25)',
            '--bg-texture': 'linear-gradient(rgba(0,0,0,0.9), rgba(0,0,0,0.9)), repeating-linear-gradient(transparent, transparent 2px, rgba(0, 243, 255, 0.05) 3px)'
        },
        labels: {
            provisions: 'Hardware',
            larderEmpty: 'System Resource Low',
            fromTheHearth: 'Firmware',
            greetingDefault: 'User',
            goals: 'Milestones',
            habits: 'Processes',
            hobbies: 'Mod-Lines',
            library: 'Data-Banks',
            todos: 'Logs',
            chores: 'Cleanup',
            social: 'Comms',
            status: 'Uplink',
            statusConfig: 'Re-Link',
            statusEstablish: 'Go Live',
            nowConsuming: 'Executing'
        },
        icons: {
            provisions: <GiRobotGrab />,
            goals: <GiLightningHelix />,
            habits: <GiCircuitry />,
            hobbies: <GiVrHeadset />,
            games: <GiSteampunkGoggles />,
            library: <GiServerRack />,
            todos: <GiMechanicalArm />,
            chores: <GiCircuitry />,
            social: <GiWalkieTalkie />,
            status: <GiSatelliteCommunication />
        }
    }
};

/* ============================================================
   Theme character
   ------------------------------------------------------------
   Colour alone was never going to make seven distinct skins.
   `--rule` — the 3px Victorian double border — was hardcoded in
   theme.css and overridden by exactly zero themes, so The Matrix
   and 8-Bit Arcade rendered Victorian double rules on every card.
   Same for radius, shadow, tracking, density and motion.

   This map gives each theme the rest of its body language. Every
   theme must define every key: ThemeContext writes these as
   inline properties on :root, so a key left out would inherit the
   previously-selected theme's value.
   ============================================================ */

// Type ramps are shared but scaled: Press Start 2P is enormous at a
// given px size, VT323 is tiny, and a handwriting face needs room.
const typeScale = (f = 1) => {
    const steps = {
        '--text-2xs': 0.6875,
        '--text-xs': 0.75,
        '--text-sm': 0.875,
        '--text-base': 1,
        '--text-lg': 1.125,
        '--text-xl': 1.375,
        '--text-2xl': 1.75,
        '--text-3xl': 2.25,
        '--text-4xl': 3,
        '--text-5xl': 4
    };
    return Object.fromEntries(
        Object.entries(steps).map(([k, v]) => [k, `${+(v * f).toFixed(4)}rem`])
    );
};

const characterBase = {
    ...typeScale(1),
    '--rule': '3px double var(--border-gold)',
    '--rule-hair': '1px solid var(--border-dim)',
    '--rule-accent': '1px solid var(--border-gold)',
    '--radius-sm': '2px',
    '--radius-md': '4px',
    '--radius-lg': '8px',
    '--tracking-heading': '0.12em',
    '--tracking-label': '0.08em',
    '--case-heading': 'uppercase',
    '--ornament-opacity': '0.5',
    '--ornament-opacity-hover': '1',
    '--ornament-width': '2px',
    '--ornament-size': '10px',
    '--shadow-sm': '0 2px 6px rgba(0, 0, 0, 0.28)',
    '--shadow-md': '0 8px 20px rgba(0, 0, 0, 0.38)',
    '--shadow-lift': '0 12px 28px rgba(0, 0, 0, 0.45)',
    '--dur-fast': '120ms',
    '--dur-base': '200ms',
    '--dur-slow': '360ms',
    '--ease': 'cubic-bezier(0.2, 0, 0.2, 1)',
    '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
    '--lift': 'translateY(-2px)',
    '--density': '1',
    '--field-bg': 'rgba(0, 0, 0, 0.2)',
    // Structural fills — deep enough to carry parchment text on top.
    '--fill-strong': '#7b2d3a',
    '--fill-quiet': '#3f5b45'
};

export const THEME_CHARACTER = {
    // Victorian: double rules, corner brackets, wide caps.
    'dark-academia': {
        ...characterBase,
        // Brass reads best as a glint, not a gilt frame.
        '--ornament-opacity': '0.38',
        '--tracking-heading': '0.1em'
    },

    // Renaissance shares the Victorian bones; Cinzel is a caps face,
    // so tracking stays generous and corners stay square.
    renaissance: {
        ...characterBase,
        '--fill-strong': '#6d2a2a',
        '--fill-quiet': '#38493c',
        '--radius-sm': '0px',
        '--radius-md': '2px',
        '--radius-lg': '3px',
        '--tracking-heading': '0.14em',
        '--density': '1.05'
    },

    // Press Start 2P is ~1.4x the visual size of a normal face and has
    // enormous built-in sidebearing, so: scale down, kill tracking.
    // Hard 3px borders, zero radius, a pixel drop shadow, no easing.
    'eight-bit': {
        ...characterBase,
        '--fill-strong': '#aa0000',
        '--fill-quiet': '#006600',
        ...typeScale(0.72),
        '--rule': '3px solid var(--border-gold)',
        '--rule-hair': '2px solid var(--border-dim)',
        '--rule-accent': '2px solid var(--border-gold)',
        '--radius-sm': '0px',
        '--radius-md': '0px',
        '--radius-lg': '0px',
        '--tracking-heading': '0em',
        '--tracking-label': '0em',
        '--ornament-opacity': '0',
        '--ornament-opacity-hover': '0',
        '--shadow-sm': '3px 3px 0 rgba(0, 0, 0, 1)',
        '--shadow-md': '5px 5px 0 rgba(0, 0, 0, 1)',
        '--shadow-lift': '7px 7px 0 rgba(0, 0, 0, 1)',
        '--dur-fast': '0ms',
        '--dur-base': '0ms',
        '--dur-slow': '0ms',
        '--ease': 'steps(2, end)',
        '--ease-out': 'steps(2, end)',
        '--lift': 'translate(-2px, -2px)',
        '--density': '0.95',
        '--field-bg': 'rgba(0, 0, 0, 0.85)'
    },

    // Cottagecore is the only light theme and its display face is a
    // handwriting script. Uppercasing handwriting is the one thing you
    // never do, so case-heading is none and the display sizes grow.
    // Shadows go warm and soft; black drops look like grime on cream.
    cottagecore: {
        ...characterBase,
        '--fill-strong': '#8a5340',
        '--fill-quiet': '#55703f',
        ...typeScale(1.06),
        '--rule': '1px solid var(--border-gold)',
        '--rule-hair': '1px solid var(--border-dim)',
        '--radius-sm': '6px',
        '--radius-md': '10px',
        '--radius-lg': '16px',
        '--tracking-heading': '0.01em',
        '--tracking-label': '0.06em',
        '--case-heading': 'none',
        '--ornament-opacity': '0',
        '--ornament-opacity-hover': '0',
        '--shadow-sm': '0 2px 8px rgba(120, 96, 62, 0.12)',
        '--shadow-md': '0 8px 22px rgba(120, 96, 62, 0.16)',
        '--shadow-lift': '0 14px 32px rgba(120, 96, 62, 0.2)',
        '--dur-base': '260ms',
        '--dur-slow': '460ms',
        '--ease': 'cubic-bezier(0.4, 0, 0.2, 1)',
        '--density': '1.2',
        '--field-bg': 'rgba(92, 75, 55, 0.06)'
    },

    // VT323 is a narrow terminal face with a small x-height: scale up,
    // pack tight, square everything off, no ornament, no soft shadow.
    matrix: {
        ...characterBase,
        '--fill-strong': '#004400',
        '--fill-quiet': '#002b00',
        ...typeScale(1.22),
        '--rule': '1px solid var(--border-gold)',
        '--rule-hair': '1px solid var(--border-dim)',
        '--rule-accent': '1px solid var(--accent-green)',
        '--radius-sm': '0px',
        '--radius-md': '0px',
        '--radius-lg': '0px',
        '--tracking-heading': '0.04em',
        '--tracking-label': '0.04em',
        '--ornament-opacity': '0',
        '--ornament-opacity-hover': '0',
        '--shadow-sm': 'none',
        '--shadow-md': '0 0 12px rgba(0, 255, 0, 0.18)',
        '--shadow-lift': '0 0 20px rgba(0, 255, 0, 0.25)',
        '--dur-fast': '60ms',
        '--dur-base': '100ms',
        '--dur-slow': '160ms',
        '--lift': 'none',
        '--density': '0.85',
        '--field-bg': 'rgba(0, 30, 0, 0.6)'
    },

    // Comfortaa and Quicksand are rounded geometric faces. Everything
    // soft: big radii, no caps, long gentle easing, generous padding.
    lofi: {
        ...characterBase,
        '--fill-strong': '#5b4a76',
        '--fill-quiet': '#3d5570',
        '--rule': '1px solid var(--border-gold)',
        '--rule-hair': '1px solid var(--border-dim)',
        '--radius-sm': '8px',
        '--radius-md': '14px',
        '--radius-lg': '22px',
        '--tracking-heading': '0.02em',
        '--tracking-label': '0.05em',
        '--case-heading': 'none',
        '--ornament-opacity': '0',
        '--ornament-opacity-hover': '0',
        '--shadow-sm': '0 3px 10px rgba(0, 0, 0, 0.3)',
        '--shadow-md': '0 10px 26px rgba(0, 0, 0, 0.35)',
        '--shadow-lift': '0 16px 36px rgba(0, 0, 0, 0.4)',
        '--dur-base': '280ms',
        '--dur-slow': '520ms',
        '--ease': 'cubic-bezier(0.34, 1.2, 0.64, 1)',
        '--density': '1.12',
        '--field-bg': 'rgba(255, 255, 255, 0.04)'
    },

    // Orbitron and Michroma are wide, engineered faces. Hairline rules,
    // neon bleed instead of drop shadow, quick snappy motion.
    cybercity: {
        ...characterBase,
        '--fill-strong': '#7a0044',
        '--fill-quiet': '#00505e',
        ...typeScale(0.94),
        '--rule': '1px solid var(--border-gold)',
        '--rule-hair': '1px solid var(--border-dim)',
        '--radius-sm': '0px',
        '--radius-md': '2px',
        '--radius-lg': '2px',
        '--tracking-heading': '0.1em',
        '--tracking-label': '0.1em',
        '--ornament-opacity': '0.35',
        '--ornament-opacity-hover': '0.9',
        '--ornament-width': '1px',
        '--ornament-size': '14px',
        '--shadow-sm': '0 0 8px rgba(255, 0, 174, 0.18)',
        '--shadow-md': '0 0 18px rgba(255, 0, 174, 0.26)',
        '--shadow-lift': '0 0 30px rgba(255, 0, 174, 0.34)',
        '--dur-fast': '80ms',
        '--dur-base': '140ms',
        '--dur-slow': '220ms',
        '--density': '0.95',
        '--field-bg': 'rgba(0, 0, 0, 0.6)'
    }
};
