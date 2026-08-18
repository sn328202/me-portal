import React, { useState } from 'react';
import WidgetCard from '../components/WidgetCard';
import { useGameStats } from '../hooks/useGameStats';
import { GiCheckMark, GiQuill } from 'react-icons/gi';
import '../styles/GameLauncher.css';

const GameLauncher = ({ title = "Game", icon: Icon, url = "#", description, accentColor }) => {
    const { logGame, isPlayedToday, getStreak } = useGameStats();
    const [showLogInput, setShowLogInput] = useState(false);
    const [logValue, setLogValue] = useState('');

    // Generate a consistent ID from the title
    const gameId = title ? title.toLowerCase().replace(/\s+/g, '_') : 'default_game';
    const played = isPlayedToday(gameId);
    const streak = getStreak(gameId);

    const handleLog = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (logValue.trim()) {
            logGame(gameId, logValue);
            setShowLogInput(false);
            setLogValue('');
        }
    };

    return (
        <div className="game-launcher-wrapper">
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="game-launcher-link"
            >
                <WidgetCard title={title} icon={Icon}>
                    <div className={`game-content ${played ? 'played' : ''}`}>
                        <div
                            className="game-icon-container"
                            style={{ color: played ? 'var(--text-gold)' : (accentColor || 'var(--text-main)') }}
                        >
                            {played ? <GiCheckMark /> : (Icon && (typeof Icon === 'function' ? <Icon /> : Icon))}
                        </div>

                        {description && !played && (
                            <p className="game-description">
                                {description}
                            </p>
                        )}

                        {played && (
                            <p className="game-played-note">
                                Completed today.<br />
                                <span className="game-streak-info">
                                    Streak: {streak} days
                                </span>
                            </p>
                        )}

                        {!played && (
                            <div className="game-launch-btn">
                                Launch
                            </div>
                        )}
                    </div>
                </WidgetCard>
            </a>

            {/* Log Button (Floating) */}
            {!played && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        setShowLogInput(!showLogInput);
                    }}
                    className="game-log-trigger"
                    title="Log Result"
                    aria-label="Log game result"
                >
                    <GiQuill />
                </button>
            )}

            {/* Log Input Popover */}
            {showLogInput && (
                <div className="game-log-popover">
                    <form onSubmit={handleLog} className="game-log-form">
                        <input
                            type="text"
                            placeholder="Score / Result..."
                            value={logValue}
                            onChange={(e) => setLogValue(e.target.value)}
                            autoFocus
                            className="game-log-input"
                        />
                        <button
                            type="submit"
                            className="game-log-submit"
                        >
                            Save
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default GameLauncher;
