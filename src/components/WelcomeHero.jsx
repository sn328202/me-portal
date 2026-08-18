import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { GiKey, GiSparkles, GiBookCover } from 'react-icons/gi';

const WelcomeHero = ({ onDismiss }) => {
    const { getLabel, themeId } = useTheme();
    const navigate = useNavigate();

    return (
        <div className="welcome-hero" style={{
            gridColumn: '1 / -1',
            background: 'var(--bg-panel)',
            border: 'var(--border-double)',
            padding: 'var(--space-xl)',
            marginBottom: 'var(--space-xl)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.8s ease-out'
        }}>
            {/* Background Decorative Element */}
            <div style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                fontSize: '15rem',
                opacity: 0.05,
                transform: 'rotate(15deg)',
                pointerEvents: 'none',
                color: 'var(--text-gold)'
            }}>
                <GiSparkles />
            </div>

            <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.5rem',
                color: 'var(--text-gold)',
                margin: '0 0 var(--space-sm) 0',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
            }}>
                Welcome to your Reality, Traveler
            </h1>

            <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1.1rem',
                color: 'var(--text-main)',
                maxWidth: '600px',
                margin: '0 0 var(--space-xl) 0',
                lineHeight: '1.6'
            }}>
                The Me Portal is a sanctum for your rituals, goals, and archives.
                Your journey begins with a few essential configurations.
            </p>

            <div style={{
                display: 'flex',
                gap: 'var(--space-xl)',
                flexWrap: 'wrap',
                justifyContent: 'center'
            }}>
                <div
                    onClick={() => navigate('/settings')}
                    style={{
                        padding: 'var(--space-lg)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        width: '200px',
                        transition: 'all 0.3s ease',
                        background: 'rgba(255,255,255,0.02)'
                    }}
                    className="welcome-card hover-bg-dim"
                >
                    <GiSparkles style={{ fontSize: '2rem', color: 'var(--text-gold)', marginBottom: 'var(--space-md)' }} />
                    <h4 style={{ fontFamily: 'var(--font-display)', margin: '0 0 var(--space-xs) 0', color: 'var(--text-gold)' }}>Initiate Vibe</h4>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>Select your aesthetic and dashboard layout.</p>
                </div>

                <div
                    onClick={() => navigate('/settings')}
                    style={{
                        padding: 'var(--space-lg)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        width: '200px',
                        transition: 'all 0.3s ease',
                        background: 'rgba(255,255,255,0.02)'
                    }}
                    className="welcome-card hover-bg-dim"
                >
                    <GiKey style={{ fontSize: '2rem', color: 'var(--text-gold)', marginBottom: 'var(--space-md)' }} />
                    <h4 style={{ fontFamily: 'var(--font-display)', margin: '0 0 var(--space-xs) 0', color: 'var(--text-gold)' }}>Link Chronometer</h4>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>Connect your Google Calendar and data feeds.</p>
                </div>

                <div
                    onClick={onDismiss}
                    style={{
                        padding: 'var(--space-lg)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        width: '200px',
                        transition: 'all 0.3s ease',
                        background: 'rgba(255,255,255,0.02)'
                    }}
                    className="welcome-card hover-bg-dim"
                >
                    <GiBookCover style={{ fontSize: '2rem', color: 'var(--text-gold)', marginBottom: 'var(--space-md)' }} />
                    <h4 style={{ fontFamily: 'var(--font-display)', margin: '0 0 var(--space-xs) 0', color: 'var(--text-gold)' }}>Explore Archives</h4>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>Close this guide and start your first ritual.</p>
                </div>
            </div>

            <button
                onClick={onDismiss}
                style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    opacity: 0.5
                }}
            >
                ×
            </button>
        </div>
    );
};

export default WelcomeHero;
