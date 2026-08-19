import React from 'react';
import { GiHourglass } from 'react-icons/gi';

/**
 * The first screen every user sees. It used to hardcode #1a1a1a, #c5a059 and
 * '"Playfair Display", serif', so the portal opened in Dark Academia and then
 * snapped to whatever skin you had actually chosen. ThemeContext paints the
 * cached theme onto :root before React mounts, so reading the variables here
 * means the loader is already in the right skin on the very first frame.
 */
const LoadingScreen = () => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            height: '100dvh',
            width: '100vw',
            background: 'var(--bg-main)',
            backgroundImage: 'var(--bg-texture)',
            color: 'var(--text-gold)',
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 9999
        }}>
            <style>
                {`
                    @keyframes loading-turn {
                        0% { transform: rotate(0deg); }
                        50% { transform: rotate(180deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes loading-pulse {
                        0% { opacity: 0.5; }
                        50% { opacity: 1; }
                        100% { opacity: 0.5; }
                    }
                    @media (prefers-reduced-motion: reduce) {
                        .loading-screen__glyph,
                        .loading-screen__caption { animation: none !important; }
                    }
                `}
            </style>
            <div
                className="loading-screen__glyph"
                style={{
                    animation: 'loading-turn 3s infinite ease-in-out',
                    fontSize: 'var(--text-4xl)',
                    marginBottom: 'var(--space-4)',
                    filter: 'drop-shadow(0 0 10px var(--accent-gold-dim))'
                }}
            >
                <GiHourglass />
            </div>
            <div
                className="loading-screen__caption"
                style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-lg)',
                    letterSpacing: 'var(--tracking-heading)',
                    textTransform: 'var(--case-heading)',
                    animation: 'loading-pulse 2s infinite ease-in-out',
                    marginTop: 'var(--space-4)'
                }}
            >
                Accessing Archive...
            </div>
        </div>
    );
};

export default LoadingScreen;
