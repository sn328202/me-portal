import React from 'react';
import { GiCrossedSwords, GiBee, GiLinkedRings, GiTicTacToe, GiCityCar, GiMagnifyingGlass, GiCardRandom } from 'react-icons/gi';
import GameLauncher from '../widgets/GameLauncher';
import { PageHeader } from '../components/ui';

/* `accent` tints each game's glyph. The Crossword's was "#000" — the
   puzzle's own brand black, and invisible on six of the seven skins.
   It now borrows the room's ink colour. */
const GAMES = [
    { title: "The Crossword", icon: GiCrossedSwords, url: "https://www.nytimes.com/crosswords/game/daily", description: "The daily challenge.", accent: "var(--text-main)" },
    { title: "Spelling Bee", icon: GiBee, url: "https://www.nytimes.com/puzzles/spelling-bee", description: "How many words can you find?", accent: "#F7DA21" },
    { title: "Connections", icon: GiLinkedRings, url: "https://www.nytimes.com/games/connections", description: "Group words by a common thread.", accent: "#B6A1E6" },
    { title: "Sudoku", icon: GiTicTacToe, url: "https://www.nytimes.com/puzzles/sudoku/medium", description: "Logic and numbers.", accent: "#F28C28" },
    { title: "Bracket City", icon: GiCityCar, url: "https://www.theatlantic.com/games/bracket-city/", description: "Navigate the history of the day.", accent: "#FF3C00" },
    { title: "Cryptic Wordle", icon: GiMagnifyingGlass, url: "https://cryptickle.com/", description: "Decipher the hidden meaning.", accent: "#4BB543" }
];

const Play = () => {
    return (
        <div className="page">
            <PageHeader
                title="The Game Parlour"
                icon={<GiCardRandom />}
                subtitle="Six daily puzzles, and a note of how each one went."
            />

            {/* Tiles were hard-locked to 300px tall regardless of what was in
                them; the row now sizes to its own content. */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(18rem, 100%), 1fr))',
                gap: 'var(--space-5)'
            }}>
                {GAMES.map((game) => (
                    <GameLauncher key={game.title} {...game} accentColor={game.accent} />
                ))}
            </div>
        </div>
    );
};

export default Play;
