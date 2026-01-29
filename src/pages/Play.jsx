import React from 'react';
import { GiCrossedSwords, GiBee, GiLinkedRings, GiTicTacToe, GiCityCar, GiMagnifyingGlass } from 'react-icons/gi';
import GameLauncher from '../widgets/GameLauncher';

const GAMES = [
    { title: "The Crossword", icon: GiCrossedSwords, url: "https://www.nytimes.com/crosswords/game/daily", description: "The daily challenge.", accent: "#000" },
    { title: "Spelling Bee", icon: GiBee, url: "https://www.nytimes.com/puzzles/spelling-bee", description: "How many words can you find?", accent: "#F7DA21" },
    { title: "Connections", icon: GiLinkedRings, url: "https://www.nytimes.com/games/connections", description: "Group words by a common thread.", accent: "#B6A1E6" },
    { title: "Sudoku", icon: GiTicTacToe, url: "https://www.nytimes.com/puzzles/sudoku/medium", description: "Logic and numbers.", accent: "#F28C28" },
    { title: "Bracket City", icon: GiCityCar, url: "https://www.theatlantic.com/games/bracket-city/", description: "Navigate the history of the day.", accent: "#FF3C00" },
    { title: "Cryptic Wordle", icon: GiMagnifyingGlass, url: "https://cryptickle.com/", description: "Decipher the hidden meaning.", accent: "#4BB543" }
];

const Play = () => {
    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h1 className="box-header" style={{
                fontSize: '2rem',
                marginBottom: 'var(--space-xl)',
                color: 'var(--text-main)',
                borderBottom: 'var(--border-double)',
                paddingBottom: 'var(--space-md)'
            }}>
                The Game Parlour
            </h1>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '2rem'
            }}>
                {GAMES.map((game, index) => (
                    <div key={index} style={{ height: '300px' }}>
                        <GameLauncher {...game} accentColor={game.accent} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Play;
