import React from 'react';
import { GiBookCover, GiWaxSeal, GiMusicalNotes, GiMechanicalArm, GiOpenChest } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';

const QuickLinksWidget = () => {
    const links = [
        { label: 'Notion', icon: GiBookCover, url: 'https://notion.so' },
        { label: 'Gmail', icon: GiWaxSeal, url: 'https://gmail.com' },
        { label: 'Spotify', icon: GiMusicalNotes, url: 'https://spotify.com' },
        { label: 'GitHub', icon: GiMechanicalArm, url: 'https://github.com' },
    ];

    return (
        <WidgetCard title="Access Log">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {links.map((link) => (
                    <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--space-md) 0',
                            borderBottom: '1px solid var(--border-dim)',
                            color: 'var(--text-muted)',
                            textDecoration: 'none',
                            fontFamily: 'var(--font-display)',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            fontSize: '0.8rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--text-gold)';
                            e.currentTarget.style.borderColor = 'var(--border-gold)';
                            e.currentTarget.style.paddingLeft = '10px';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)';
                            e.currentTarget.style.borderColor = 'var(--border-dim)';
                            e.currentTarget.style.paddingLeft = '0px';
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <link.icon size={20} />
                            <span>{link.label}</span>
                        </div>
                        <GiOpenChest size={14} style={{ opacity: 0.5 }} />
                    </a>
                ))}
            </div>
        </WidgetCard>
    );
};

export default QuickLinksWidget;
