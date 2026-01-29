import React, { useState } from 'react';
import WidgetCard from '../components/WidgetCard';
import { useGameStats } from '../hooks/useGameStats';
import { GiCheckMark, GiQuill } from 'react-icons/gi';

const GameLauncher = ({ title, icon: Icon, url, description, accentColor }) => {
    const { logGame, isPlayedToday, getStreak } = useGameStats();
    const [showLogInput, setShowLogInput] = useState(false);
    const [logValue, setLogValue] = useState('');

    // Generate a consistent ID from the title
    const gameId = title.toLowerCase().replace(/\s+/g, '_');
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
        <div style={{ position: 'relative', height: '100%' }}>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'block', height: '100%' }}
            >
                <WidgetCard title={title} icon={Icon}>
                    <div style={{
                        padding: 'var(--space-md) 0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        gap: 'var(--space-md)',
                        filter: played ? 'grayscale(0.8)' : 'none', // Dim if played
                        opacity: played ? 0.7 : 1,
                        transition: 'all 0.3s ease'
                    }}>
                        <div style={{
                            fontSize: '3rem',
                            color: played ? 'var(--text-gold)' : (accentColor || 'var(--text-main)'),
                            transition: 'transform 0.3s ease',
                        }}
                            className="game-icon"
                        >
                            {played ? <GiCheckMark /> : (Icon && <Icon />)}
                        </div>

                        {description && !played && (
                            <p style={{
                                textAlign: 'center',
                                fontSize: '0.9rem',
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                                lineHeight: '1.4'
                            }}>
                                {description}
                            </p>
                        )}

                        {played && (
                            <p style={{
                                textAlign: 'center',
                                fontSize: '0.9rem',
                                color: 'var(--text-gold)',
                                fontStyle: 'italic',
                                fontFamily: 'var(--font-display)'
                            }}>
                                Completed today.<br />
                                <span style={{ fontSize: '0.7em', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Streak: {streak} days
                                </span>
                            </p>
                        )}

                        <div style={{
                            marginTop: 'auto',
                            padding: 'var(--space-xs) var(--space-md)',
                            border: '1px solid var(--border-dim)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            color: 'var(--text-gold)',
                            fontFamily: 'var(--font-display)',
                            transition: 'all 0.2s ease',
                            opacity: played ? 0 : 1 // Hide launch button if played
                        }}
                            className="play-button"
                        >
                            Launch
                        </div>
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
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        zIndex: 10
                    }}
                    title="Log Result"
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    <GiQuill />
                </button>
            )}

            {/* Log Input Popover */}
            {showLogInput && (
                <div style={{
                    position: 'absolute',
                    top: '45px',
                    right: '10px',
                    width: '200px',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-gold)',
                    padding: 'var(--space-sm)',
                    zIndex: 20,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}>
                    <form onSubmit={handleLog} style={{ display: 'flex', gap: '5px' }}>
                        <input
                            type="text"
                            placeholder="Score / Result..."
                            value={logValue}
                            onChange={(e) => setLogValue(e.target.value)}
                            autoFocus
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1px solid var(--border-dim)',
                                color: 'var(--text-main)',
                                fontFamily: 'var(--font-display)',
                                fontSize: '0.8rem',
                                padding: '4px'
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                background: 'var(--accent-gold)',
                                border: 'none',
                                color: '#000',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                padding: '0 8px',
                                textTransform: 'uppercase'
                            }}
                        >
                            Save
                        </button>
                    </form>
                </div>
            )}

            <style>
                {`
                        .widget-card:hover .game-icon {
                            transform: scale(1.1) rotate(5deg);
                            color: var(--accent-gold) !important;
                        }
                        .widget-card:hover .play-button {
                            border-color: var(--accent-gold);
                            background: var(--bg-hover);
                        }
                    `}
            </style>
        </div>
    );
};

export default GameLauncher;
