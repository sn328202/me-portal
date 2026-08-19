import React, { useEffect, useRef, useState } from 'react';
import Button from './Button';

/**
 * Two-click destructive action with a 3s reset.
 *
 * The app had three incompatible delete patterns — native confirm(), two-click
 * with reset, two-click without — and six different confirm labels. This is
 * the one that wins, and it keeps each room's voice through `confirmLabel`
 * ("CONFIRM: BURN THIS FILE?" stays).
 */
const ConfirmButton = ({
    onConfirm,
    label = 'Delete',
    confirmLabel = 'Confirm?',
    size = 'sm',
    icon,
    children,
    ...rest
}) => {
    const [armed, setArmed] = useState(false);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    const handleClick = () => {
        if (armed) {
            clearTimeout(timer.current);
            setArmed(false);
            onConfirm();
            return;
        }
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), 3000);
    };

    return (
        <Button
            variant={armed ? 'danger' : 'ghost'}
            size={size}
            icon={!armed && !children}
            label={armed ? confirmLabel : label}
            onClick={handleClick}
            {...rest}
        >
            {armed ? confirmLabel : children || icon}
        </Button>
    );
};

export default ConfirmButton;
