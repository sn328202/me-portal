import React from 'react';

/**
 * One tab strip, two variants. There were five mutually exclusive designs —
 * filled boxes, underlines, a segmented pill, outlined buttons, and file
 * folders — one per page.
 *
 * variant 'underline' (default): switching between different content
 * variant 'segmented': switching how the SAME content is displayed
 *
 * tabs: [{ id, label, icon?, count? }]
 */
const Tabs = ({ tabs, active, onChange, variant = 'underline', label = 'Sections', className = '' }) => (
    <div
        role="tablist"
        aria-label={label}
        className={['tabs', variant === 'segmented' ? 'tabs--segmented' : '', className]
            .filter(Boolean)
            .join(' ')}
    >
        {tabs.map((tab) => (
            <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={active === tab.id}
                aria-controls={`panel-${tab.id}`}
                tabIndex={active === tab.id ? 0 : -1}
                className="tab"
                onClick={() => onChange(tab.id)}
                onKeyDown={(e) => {
                    const i = tabs.findIndex((t) => t.id === active);
                    let next = null;
                    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
                    if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
                    if (e.key === 'Home') next = tabs[0];
                    if (e.key === 'End') next = tabs[tabs.length - 1];
                    if (!next) return;
                    e.preventDefault();
                    onChange(next.id);
                    // Roving tabindex: selection has to take focus with it,
                    // otherwise the arrow keys stop working after one press.
                    e.currentTarget.parentElement
                        ?.querySelector(`#tab-${CSS.escape(next.id)}`)
                        ?.focus();
                }}
            >
                {tab.icon}
                {tab.label}
                {typeof tab.count === 'number' && <span className="muted"> ({tab.count})</span>}
            </button>
        ))}
    </div>
);

export const TabPanel = ({ id, active, children }) =>
    active === id ? (
        <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0}>
            {children}
        </div>
    ) : null;

export default Tabs;
