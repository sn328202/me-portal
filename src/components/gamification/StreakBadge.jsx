import React from 'react';
import { GiRibbonMedal, GiTrophy, GiLaurels } from 'react-icons/gi';

const StreakBadge = ({ label, count, icon, color = 'var(--text-gold)' }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '0.5rem 1rem',
            border: `2px solid ${color}`,
            borderRadius: '8px',
            background: 'var(--bg-panel)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            minWidth: '100px',
            position: 'relative'
        }}>
            <div style={{
                fontSize: '2rem',
                color: color,
                marginBottom: '0.2rem',
                filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))'
            }}>
                {count >= 7 ? <GiTrophy /> : count >= 3 ? <GiRibbonMedal /> : icon || <GiLaurels />}
            </div>
            <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2rem',
                fontWeight: 'bold',
                lineHeight: 1,
                color: count > 0 ? color : 'var(--text-muted)'
            }}>
                {count}
            </div>
            <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                marginTop: '0.2rem',
                letterSpacing: '0.1em',
                color: 'var(--text-muted)'
            }}>
                {label}
            </div>

            {/* Victorian Flourish */}
            <div style={{
                position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)',
                width: '40px', height: '2px', background: color, opacity: 0.5
            }} />
        </div>
    );
};

export default StreakBadge;
