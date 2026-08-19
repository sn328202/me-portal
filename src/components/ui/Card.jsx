import React from 'react';

/**
 * The surface every panel in the app should be built on.
 *
 * Previously `.widget-card` was a good component that five pages and three
 * widgets bypassed with hand-rolled clones — differing padding, no corner
 * ornaments, no hover. This is the same component with a real API.
 *
 * variant: 'raised' (double rule + ornaments) | 'flat' (hairline, for nested
 *          surfaces and dense list rows)
 */
const Card = React.forwardRef(function Card(
    {
        title,
        icon,
        actions,
        variant = 'raised',
        interactive = false,
        scroll = false,
        padded = true,
        as: Tag = 'section',
        className = '',
        bodyClassName = '',
        children,
        ...rest
    },
    ref
) {
    const classes = [
        'card',
        variant === 'flat' ? 'card--flat' : '',
        interactive ? 'card--interactive' : '',
        padded ? '' : 'card--pad-none',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const bodyClasses = [
        'card__body',
        scroll === 'tall' ? 'card__body--scroll-tall' : scroll ? 'card__body--scroll' : '',
        bodyClassName,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <Tag ref={ref} className={classes} {...rest}>
            {(title || actions) && (
                <header className="card__header">
                    <h3 className="card__title">
                        {icon && <span className="widget-icon">{icon}</span>}
                        {title}
                    </h3>
                    {actions && <div className="card__actions">{actions}</div>}
                </header>
            )}
            <div className={bodyClasses}>{children}</div>
        </Tag>
    );
});

export default Card;
