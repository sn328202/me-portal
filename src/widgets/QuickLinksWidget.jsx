import React from 'react';
import { GiBookCover, GiWaxSeal, GiMusicalNotes, GiMechanicalArm, GiOpenChest } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import '../styles/QuickLinksWidget.css';

const QuickLinksWidget = () => {
    const links = [
        { label: 'Notion', icon: GiBookCover, url: 'https://notion.so' },
        { label: 'Gmail', icon: GiWaxSeal, url: 'https://gmail.com' },
        { label: 'Spotify', icon: GiMusicalNotes, url: 'https://spotify.com' },
        { label: 'GitHub', icon: GiMechanicalArm, url: 'https://github.com' },
    ];

    return (
        <WidgetCard title="Access Log">
            <div className="quick-links-container">
                {links.map((link) => (
                    <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="quick-link-item"
                    >
                        <div className="quick-link-content">
                            <link.icon size={20} />
                            <span>{link.label}</span>
                        </div>
                        <GiOpenChest size={14} className="quick-link-external-icon" />
                    </a>
                ))}
            </div>
        </WidgetCard>
    );
};

export default QuickLinksWidget;
