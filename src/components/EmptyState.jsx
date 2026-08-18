import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const EmptyState = ({ message, actionLabel, onAction, icon: Icon }) => {
    const { getIcon } = useTheme();
    const displayIcon = Icon || getIcon('status');

    return (
        <div className="empty-state" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-xl) var(--space-md)',
            textAlign: 'center',
            opacity: 0.7,
            border: '1px dashed var(--border-dim)',
            borderRadius: 'var(--radius-md)',
            margin: 'var(--space-md)'
        }}>
            <div className="empty-state-icon" style={{
                fontSize: '2.5rem',
                marginBottom: 'var(--space-md)',
                color: 'var(--text-gold)'
            }}>
                {displayIcon}
            </div>
            <p className="empty-state-message" style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                color: 'var(--text-main)',
                marginBottom: 'var(--space-lg)',
                maxWidth: '250px',
                lineHeight: '1.5'
            }}>
                {message || 'The ledger is currently blank.'}
            </p>
            {actionLabel && (
                <button
                    onClick={onAction}
                    className="empty-state-action"
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--border-gold)',
                        color: 'var(--text-gold)',
                        padding: 'var(--space-xs) var(--space-md)',
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                        e.target.style.background = 'var(--accent-gold)';
                        e.target.style.color = 'var(--bg-main)';
                    }}
                    onMouseLeave={e => {
                        e.target.style.background = 'transparent';
                        e.target.style.color = 'var(--text-gold)';
                    }}
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
