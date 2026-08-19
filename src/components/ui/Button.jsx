import React from 'react';

/**
 * The app's one button. Replaces four hand-copied variants that had
 * dark-academia's gold (`rgba(207,181,59,0.1)`) hardcoded into the markup.
 *
 * variant: 'default' | 'primary' | 'solid' | 'ghost' | 'danger'
 * size:    'md' | 'sm'
 * icon:    when true, renders a square icon-only button — `label` is then
 *          required and becomes the accessible name.
 */
const Button = React.forwardRef(function Button(
    {
        variant = 'default',
        size = 'md',
        icon = false,
        block = false,
        label,
        as: Tag = 'button',
        className = '',
        children,
        ...rest
    },
    ref
) {
    const classes = [
        'btn',
        variant !== 'default' ? `btn--${variant}` : '',
        size === 'sm' ? 'btn--sm' : '',
        icon ? 'btn--icon' : '',
        block ? 'btn--block' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const a11y = icon || (!children && label) ? { 'aria-label': label } : {};
    const typeProp = Tag === 'button' && !rest.type ? { type: 'button' } : {};

    return (
        <Tag ref={ref} className={classes} title={label} {...typeProp} {...a11y} {...rest}>
            {children}
        </Tag>
    );
});

export default Button;
