import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Button from './ui/Button';

/**
 * One empty state. There were sixteen across the app in at least eight
 * designs — 1px vs 2px dashed, 0.8/0.9/1.2rem text, 0/2/3rem padding, icons
 * at 0/24/48/64px and 0.2/0.5/1.0 opacity.
 *
 * The voice stays per-room ("The pantry is locked.", "Null Pointer
 * Exception"); only the frame is shared.
 */
const EmptyState = ({ message, hint, actionLabel, onAction, icon: Icon, inline = false }) => {
    const { getIcon } = useTheme();
    const displayIcon = Icon || getIcon('status');

    return (
        <div className={['empty', inline ? 'empty--inline' : ''].filter(Boolean).join(' ')}>
            {displayIcon && <span className="empty__icon">{displayIcon}</span>}
            <p className="empty__message">{message || 'The ledger is currently blank.'}</p>
            {hint && <p className="empty__hint">{hint}</p>}
            {actionLabel && (
                <Button variant="primary" size="sm" onClick={onAction}>
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};

export default EmptyState;
