import React from 'react';
import { GiRibbonMedal, GiTrophy, GiLaurels } from 'react-icons/gi';
import '../../styles/StreakBadge.css';

const StreakBadge = ({ label, count, icon, color }) => {
    const badgeStyle = color ? { '--badge-color': color } : {};

    return (
        <div className="streak-badge" style={badgeStyle}>
            <div className="streak-icon">
                {count >= 7 ? <GiTrophy /> : count >= 3 ? <GiRibbonMedal /> : icon || <GiLaurels />}
            </div>
            <div className={`streak-count ${count === 0 ? 'zero' : ''}`}>
                {count}
            </div>
            <div className="streak-label">
                {label}
            </div>
            <div className="streak-flourish" />
        </div>
    );
};

export default StreakBadge;
