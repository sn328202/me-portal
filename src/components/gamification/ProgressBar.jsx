import React from 'react';
import { GiCheckeredFlag } from 'react-icons/gi';

const ProgressBar = ({ current, max, icon, color = 'var(--accent-gold)' }) => {
    // Clamp percentage 0-100
    const rawPercent = max > 0 ? (current / max) * 100 : 0;
    const percentage = Math.min(100, Math.max(0, rawPercent));
    const isComplete = percentage === 100;

    return (
        <div style={{ padding: '0.5rem 0', width: '100%' }}>
            {/* Track */}
            <div style={{
                height: '6px',
                background: 'var(--border-dim)',
                borderRadius: '3px',
                position: 'relative',
                margin: '10px 0',
                display: 'flex',
                alignItems: 'center'
            }}>
                {/* Fill */}
                <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: isComplete ? 'var(--accent-green)' : color,
                    borderRadius: '3px',
                    transition: 'width 0.5s ease-out',
                    position: 'relative'
                }}>
                    {/* The "Traveler" (Icon that moves) */}
                    <div style={{
                        position: 'absolute',
                        right: -10, // Offset to center on the end of the bar
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '1.2rem',
                        color: isComplete ? 'var(--accent-green)' : color,
                        transition: 'color 0.3s',
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))'
                    }}>
                        {icon}
                    </div>
                </div>

                {/* Finish Line */}
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: isComplete ? 'var(--accent-green)' : 'var(--text-muted)',
                    fontSize: '1rem',
                    opacity: isComplete ? 1 : 0.5
                }}>
                    <GiCheckeredFlag />
                </div>
            </div>

            {/* Stats */}
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)'
            }}>
                <span>Progress</span>
                <span>{current} / {max}</span>
            </div>
        </div>
    );
};

export default ProgressBar;
