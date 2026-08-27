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
    'studio': {
        name: 'Studio',
        id: 'studio',
        palette: [
            { name: 'Clay', hex: '#b4543f' },
            { name: 'Sage', hex: '#5b7c5a' },
            { name: 'Brass', hex: '#7d5a3c' },
            { name: 'Slate', hex: '#4a6284' },
            { name: 'Plum', hex: '#8a5c74' },
            { name: 'Ochre', hex: '#c9944e' },
            { name: 'Teal', hex: '#3c8f7e' },
            { name: 'Ink', hex: '#23201c' },
        ],
        fontImports: [],
        cssVars: {
            /* The clean, warm-neutral look from the outfit planner: an off-white
               room, white cards, a single soft brown accent, hairline warm rules
               and a system sans. This is the default skin. */
            '--bg-main': '#f6f5f3',
            '--bg-panel': '#ffffff',
            '--bg-hover': '#f0e7e0',
            '--bg-main-rgb': '246, 245, 243',
            '--text-main': '#23201c',
            '--text-muted': '#8a847b',
            '--text-dim': '#a49c92',
            '--text-gold': '#9b6a4f',
            '--text-highlight': '#7d5238',
            '--accent-crimson': '#b4543f',
            '--accent-red': '#b4543f',
            '--accent-green': '#5b7c5a',
            '--accent-gold': '#9b6a4f',
            '--accent-gold-dim': 'rgba(155, 106, 79, 0.14)',
            '--border-gold': '#d8cfc4',
            '--border-bright': '#9b6a4f',
            '--border-dim': '#e7e3dc',
            '--active-border': '#9b6a4f',
            '--fill-strong': '#9b6a4f',
            '--fill-quiet': '#5b7c5a',
            '--font-display': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            '--font-body': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            '--font-mono': "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            '--font-serif': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            '--radius-lg': '14px',
            '--glass-panel': 'rgba(255, 255, 255, 0.9)',
            '--glow-gold': '0 1px 3px rgba(0, 0, 0, 0.06)',
            '--bg-texture': 'none'
        },
        labels: {
            provisions: 'Groceries',
            larderEmpty: 'The larder is empty.',
            fromTheHearth: 'From the Kitchen',
            greetingDefault: 'Neha',
            goals: 'Goals',
            habits: 'Habits',
            hobbies: 'Hobbies',
            library: 'Library',
            todos: 'To-dos',
            chores: 'Chores',
            social: 'People',
            status: 'Status',
            statusConfig: 'Configure',
            statusEstablish: 'Connect',
            nowConsuming: 'Now Reading'
        },
        icons: {
            provisions: <GiBasket />,
            goals: <GiScrollUnfurled />,
            habits: <GiSprout />,
            hobbies: <GiButterfly />,
            games: <GiGamepad />,
            library: <GiScrollUnfurled />,
            todos: <GiQuill />,
            chores: <GiHand />,
            social: <GiCoffeeCup />,
            status: <GiControlTower />
        }
    },
    'studio-dark': {
        name: 'Studio Dark',
        id: 'studio-dark',
        palette: [
            { name: 'Clay', hex: '#d97158' },
            { name: 'Sage', hex: '#8faa87' },
            { name: 'Brass', hex: '#c79878' },
            { name: 'Slate', hex: '#8ba3b4' },
            { name: 'Plum', hex: '#b78ba4' },
            { name: 'Butter', hex: '#e8d08a' },
            { name: 'Teal', hex: '#5fb0b8' },
            { name: 'Bone', hex: '#ece7e1' },
        ],
        fontImports: [],
        cssVars: {
            /* Studio after dark: the same clean, warm-neutral system inverted
               onto a warm espresso ground. Not pure black — a lifted charcoal
               with the same soft brown accent, so it reads as the night version
               of the same room. */
            '--bg-main': '#1a1816',
            '--bg-panel': '#242120',
            '--bg-hover': '#302b28',
            '--bg-main-rgb': '26, 24, 22',
            '--text-main': '#ece7e1',
            '--text-muted': '#a89f95',
            '--text-dim': '#8d857b',
            '--text-gold': '#c79878',
            '--text-highlight': '#dcb08c',
            '--accent-crimson': '#cf7f6b',
            '--accent-red': '#cf7f6b',
            '--accent-green': '#8faa87',
            '--accent-gold': '#c79878',
            '--accent-gold-dim': 'rgba(199, 152, 120, 0.16)',
            '--border-gold': '#4a423b',
            '--border-bright': '#c79878',
            '--border-dim': '#383431',
            '--active-border': '#c79878',
            '--fill-strong': '#9b6a4f',
            '--fill-quiet': '#4a5a48',
            '--font-display': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            '--font-body': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            '--font-mono': "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            '--font-serif': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            '--radius-lg': '14px',
            '--glass-panel': 'rgba(36, 33, 32, 0.9)',
            '--glow-gold': '0 1px 3px rgba(0, 0, 0, 0.4)',
            '--bg-texture': 'none'
        },
        labels: {
            provisions: 'Groceries',
            larderEmpty: 'The larder is empty.',
            fromTheHearth: 'From the Kitchen',
            greetingDefault: 'Neha',
            goals: 'Goals',
            habits: 'Habits',
            hobbies: 'Hobbies',
            library: 'Library',
            todos: 'To-dos',
            chores: 'Chores',
            social: 'People',
            status: 'Status',
            statusConfig: 'Configure',
            statusEstablish: 'Connect',
            nowConsuming: 'Now Reading'
        },
        icons: {
            provisions: <GiBasket />,
            goals: <GiScrollUnfurled />,
            habits: <GiSprout />,
            hobbies: <GiButterfly />,
            games: <GiGamepad />,
            library: <GiScrollUnfurled />,
            todos: <GiQuill />,
            chores: <GiHand />,
            social: <GiCoffeeCup />,
            status: <GiControlTower />
        }
    },
    'dark-academia': {
        name: 'Dark Academia',
        id: 'dark-academia',
        palette: [
            { name: 'Rose', hex: '#dc8b95' },
            { name: 'Brass', hex: '#cfa15e' },
            { name: 'Sage', hex: '#9db99d' },
            { name: 'Aubergine', hex: '#7b5a78' },
            { name: 'Oxblood', hex: '#a4485a' },
            { name: 'Parchment', hex: '#f2e6de' },
            { name: 'Ink Blue', hex: '#6c7fa3' },
            { name: 'Moss', hex: '#7d8f5e' },
        ],
        fontImports: ['Playfair Display', 'Inter', 'Courier Prime'],
        cssVars: {
            /* Wine and candlelight. Brass and khaki are gone entirely — every
               token now sits in the red half of the wheel (hue 350-30) or
               is a warm neutral. The metal is copper, not gold; the ground
               is plum-cocoa lifted out of near-black so the room reads as
               velvet rather than ink. */
            '--bg-main': '#201620',
            '--bg-panel': '#2b1f2a',
            '--bg-hover': '#3a2b38',
            '--bg-main-rgb': '32, 22, 32',
            '--text-main': '#f2e6de',
            '--text-muted': '#bda6a4',
            '--text-dim': '#d3c1bd',
            '--text-gold': '#d9a37c',
            '--text-highlight': '#f4cfae',
            '--accent-crimson': '#dc8b95',
            '--accent-red': '#e89493',
            '--accent-green': '#9db99d',
            '--accent-gold': '#d9a37c',
            '--accent-gold-dim': 'rgba(217, 163, 124, 0.15)',
            '--border-gold': '#b07c69',
            '--border-bright': '#d9a37c',
            '--border-dim': '#8d7276',
            '--active-border': '#d9a37c',
            '--fill-strong': '#71263c',
            '--fill-quiet': '#4f5d4d',
            '--font-display': "'Playfair Display', serif",
            '--font-body': "'Inter', sans-serif",
            '--font-mono': "'Courier Prime', monospace",
            '--font-serif': "'Cormorant Garamond', Georgia, serif",
            '--radius-lg': '8px',
            '--glass-panel': 'rgba(43, 31, 42, 0.95)',
            '--glow-gold': '0 0 14px rgba(217, 163, 124, 0.2)',
            '--bg-texture': 'radial-gradient(1200px 800px at 12% -8%, rgba(217, 163, 124, 0.055), transparent 60%), radial-gradient(1000px 700px at 100% 108%, rgba(113, 38, 60, 0.07), transparent 62%)'
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
        palette: [
            { name: 'Red', hex: '#ff5555' },
            { name: 'Orange', hex: '#ff9955' },
            { name: 'Yellow', hex: '#ffff00' },
            { name: 'Green', hex: '#00ff00' },
            { name: 'Cyan', hex: '#00ffff' },
            { name: 'Blue', hex: '#5599ff' },
            { name: 'Magenta', hex: '#ff55ff' },
            { name: 'White', hex: '#ffffff' },
        ],
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
        palette: [
            { name: 'Rose', hex: '#a84a4a' },
            { name: 'Terracotta', hex: '#c47a52' },
            { name: 'Honey', hex: '#c9a227' },
            { name: 'Fern', hex: '#41663a' },
            { name: 'Sage', hex: '#7a8b5c' },
            { name: 'Cornflower', hex: '#6d84a8' },
            { name: 'Lilac', hex: '#9b7ba8' },
            { name: 'Bark', hex: '#7a6247' },
        ],
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
        palette: [
            { name: 'Phosphor', hex: '#00ff00' },
            { name: 'Bright', hex: '#7dff7d' },
            { name: 'Deep', hex: '#009a2e' },
            { name: 'Dim', hex: '#005c18' },
            { name: 'Amber', hex: '#ffb000' },
            { name: 'White', hex: '#ffffff' },
            { name: 'Cyan', hex: '#00ffc8' },
            { name: 'Lime', hex: '#b6ff00' },
        ],
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
        palette: [
            { name: 'Lavender', hex: '#bb9af7' },
            { name: 'Blue', hex: '#7aa2f7' },
            { name: 'Rose', hex: '#f7768e' },
            { name: 'Lime', hex: '#9ece6a' },
            { name: 'Cyan', hex: '#7dcfff' },
            { name: 'Amber', hex: '#e0af68' },
            { name: 'Teal', hex: '#73daca' },
            { name: 'Mist', hex: '#a9b1d6' },
        ],
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
        palette: [
            { name: 'Gold', hex: '#d4af37' },
            { name: 'Vermilion', hex: '#cf6a6a' },
            { name: 'Verdigris', hex: '#6f9c7a' },
            { name: 'Ultramarine', hex: '#4a6fa5' },
            { name: 'Ivory', hex: '#f0e6d2' },
            { name: 'Umber', hex: '#8a6b3f' },
            { name: 'Oxblood', hex: '#7a2230' },
            { name: 'Violet', hex: '#6b4c8a' },
        ],
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
        palette: [
            { name: 'Magenta', hex: '#ff00ae' },
            { name: 'Cyan', hex: '#00f3ff' },
            { name: 'Red', hex: '#ff003c' },
            { name: 'Mint', hex: '#00ff9f' },
            { name: 'Violet', hex: '#9d4edd' },
            { name: 'Amber', hex: '#ffb703' },
            { name: 'Blue', hex: '#0077ff' },
            { name: 'White', hex: '#ffffff' },
        ],
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
    },
    /*
       Retro — taken from therange.fyi, sampled from the rendered page rather
       than guessed: a soft blue-grey ground, cream sticker cards outlined in
       espresso with a hard offset shadow, and cobalt doing the work that gold
       does elsewhere. The wide palette is the point — the site carries eight
       hues at once (cobalt, coral, olive, pink, chartreuse) and stays calm,
       which is the trick the other skins were missing.
    */
    'retro': {
        name: 'Retro Press',
        id: 'retro',
        palette: [
            { name: 'Cobalt', hex: '#1e50d2' },
            { name: 'Espresso', hex: '#372420' },
            { name: 'Cream', hex: '#ece0d4' },
            { name: 'Sky', hex: '#b1c3d0' },
            { name: 'Coral', hex: '#e0866a' },
            { name: 'Olive', hex: '#6f7629' },
            { name: 'Pink', hex: '#e58fbd' },
            { name: 'Chartreuse', hex: '#c4cc59' },
        ],
        fontImports: ['Archivo Black', 'Space Mono'],
        cssVars: {
            '--bg-main': '#b1c3d0',
            '--bg-panel': '#ece0d4',
            '--bg-hover': '#dccec0',
            '--bg-main-rgb': '177, 195, 208',
            '--text-main': '#372420',
            '--text-muted': '#6d574e',
            '--text-dim': '#8a7369',
            /* The site prints every label, date and byline in cobalt. It is
               the value colour here, whatever the token happens to be named. */
            '--text-gold': '#1e50d2',
            '--text-highlight': '#1e50d2',
            '--accent-crimson': '#c9583c',
            '--accent-red': '#c9583c',
            '--accent-green': '#6f7629',
            '--accent-gold': '#1e50d2',
            '--accent-gold-dim': 'rgba(30, 80, 210, 0.14)',
            /* Borders are ink, not a tint: the whole look is heavy espresso
               outlines on cream, the way a printed sticker is die-cut. */
            '--border-gold': '#372420',
            '--border-bright': '#1e50d2',
            '--border-dim': '#a3b5c3',
            '--active-border': '#1e50d2',
            '--fill-strong': '#372420',
            '--fill-quiet': '#6f7629',
            '--font-display': "'Archivo Black', 'Helvetica Neue', Impact, sans-serif",
            '--font-body': "'Space Mono', ui-monospace, Menlo, monospace",
            '--font-mono': "'Space Mono', ui-monospace, Menlo, monospace",
            '--font-serif': "'Space Mono', ui-monospace, Menlo, monospace",
            '--radius-lg': '16px',
            '--glass-panel': 'rgba(236, 224, 212, 0.95)',
            /* No soft blur anywhere: the shadow is a solid offset block. */
            '--glow-gold': '3px 3px 0 #372420',
            '--bg-texture': 'none'
        },
        labels: {
            provisions: 'Supplies',
            larderEmpty: 'Nothing in stock.',
            fromTheHearth: 'The Kitchen',
            greetingDefault: 'Neha',
            goals: 'The Plan',
            habits: 'The Streak',
            hobbies: 'Pastimes',
            library: 'The Stack',
            todos: 'The List',
            chores: 'Upkeep',
            social: 'The Crowd',
            status: 'The Wire',
            statusConfig: 'Tune',
            statusEstablish: 'Hook Up',
            nowConsuming: 'Currently'
        },
        icons: {
            provisions: <GiBasket />,
            goals: <GiScrollUnfurled />,
            habits: <GiSprout />,
            hobbies: <GiButterfly />,
            games: <GiGamepad />,
            library: <GiScrollUnfurled />,
            todos: <GiQuill />,
            chores: <GiHand />,
            social: <GiCoffeeCup />,
            status: <GiControlTower />
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
    '--border-width': '1px',
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
    // Studio: the planner's clean look. Hairline warm rules (no Victorian
    // double border), soft rounded cards, gentle drop shadows, no corner
    // ornaments, sentence-case headings, quiet tracking, roomy padding.
    studio: {
        ...characterBase,
        '--fill-strong': '#9b6a4f',
        '--fill-quiet': '#5b7c5a',
        '--rule': '1px solid var(--border-dim)',
        '--rule-hair': '1px solid var(--border-dim)',
        '--rule-accent': '1px solid var(--border-gold)',
        '--radius-sm': '8px',
        '--radius-md': '10px',
        '--radius-lg': '14px',
        '--tracking-heading': '0.01em',
        '--tracking-label': '0.04em',
        '--case-heading': 'none',
        '--ornament-opacity': '0',
        '--ornament-opacity-hover': '0',
        '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.06)',
        '--shadow-md': '0 1px 3px rgba(0, 0, 0, 0.06), 0 6px 18px rgba(0, 0, 0, 0.05)',
        '--shadow-lift': '0 10px 28px rgba(0, 0, 0, 0.08)',
        '--dur-base': '200ms',
        '--dur-slow': '320ms',
        '--ease': 'cubic-bezier(0.2, 0, 0.2, 1)',
        '--density': '1.05',
        '--field-bg': 'rgba(35, 32, 28, 0.03)'
    },

    // Studio Dark: same clean bones as Studio, but shadows go deeper for a
    // dark ground and the input fill inverts to a faint light wash.
    'studio-dark': {
        ...characterBase,
        '--fill-strong': '#9b6a4f',
        '--fill-quiet': '#4a5a48',
        '--rule': '1px solid var(--border-dim)',
        '--rule-hair': '1px solid var(--border-dim)',
        '--rule-accent': '1px solid var(--border-gold)',
        '--radius-sm': '8px',
        '--radius-md': '10px',
        '--radius-lg': '14px',
        '--tracking-heading': '0.01em',
        '--tracking-label': '0.04em',
        '--case-heading': 'none',
        '--ornament-opacity': '0',
        '--ornament-opacity-hover': '0',
        '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
        '--shadow-md': '0 1px 3px rgba(0, 0, 0, 0.4), 0 8px 20px rgba(0, 0, 0, 0.35)',
        '--shadow-lift': '0 12px 28px rgba(0, 0, 0, 0.45)',
        '--dur-base': '200ms',
        '--dur-slow': '320ms',
        '--ease': 'cubic-bezier(0.2, 0, 0.2, 1)',
        '--density': '1.05',
        '--field-bg': 'rgba(255, 255, 255, 0.04)'
    },

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
    },

    // Retro Press: die-cut stickers. Thick espresso outlines, pill corners,
    // a hard offset shadow instead of a blur, mono labels in wide caps, and
    // motion that pops rather than eases.
    retro: {
        ...characterBase,
        '--fill-strong': '#372420',
        '--fill-quiet': '#6f7629',
        '--rule': '2px solid var(--border-gold)',
        '--rule-hair': '1px solid var(--border-dim)',
        '--rule-accent': '2px dashed var(--border-gold)',
        '--radius-sm': '6px',
        '--radius-md': '12px',
        '--radius-lg': '16px',
        '--tracking-heading': '0.01em',
        '--tracking-label': '0.1em',
        '--case-heading': 'uppercase',
        '--ornament-opacity': '0',
        '--ornament-opacity-hover': '0',
        '--border-width': '2px',
        // Solid, un-blurred, offset down-right — the whole reason the source
        // site reads as printed rather than as a web page.
        '--shadow-sm': '2px 2px 0 #372420',
        '--shadow-md': '3px 3px 0 #372420',
        '--shadow-lift': '5px 5px 0 #372420',
        '--dur-fast': '90ms',
        '--dur-base': '140ms',
        '--dur-slow': '220ms',
        '--ease': 'cubic-bezier(0.2, 0.8, 0.3, 1.2)',
        '--lift': 'translate(-2px, -2px)',
        '--density': '1.05',
        '--field-bg': 'rgba(55, 36, 32, 0.06)'
    }
};

/* ============================================================
   Palettes
   ------------------------------------------------------------
   Every theme used to carry four working hues — crimson, green,
   gold and whatever `--text-highlight` happened to be — and three
   of those were usually the same colour at different lightness.
   Anything that needed a *set* of colours (map pins, category
   chips, charts) therefore drew eight near-identical browns.

   Each theme now declares eight named hues that belong together.
   ThemeContext writes them to :root as --c-1 … --c-8, so a
   component that needs the nth distinct colour asks for it by
   number and gets something that suits the current skin.
   ============================================================ */

/** Ordered hues for the given theme, always eight long. */
export const paletteOf = (id) => (THEMES[id] || THEMES.studio).palette || [];

/** The `--c-1` … `--c-8` custom properties for a theme. */
export const paletteVars = (id) =>
    Object.fromEntries(paletteOf(id).map((c, i) => [`--c-${i + 1}`, c.hex]));
