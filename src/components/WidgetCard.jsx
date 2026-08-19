import React from 'react';
import Card from './ui/Card';
import Button from './ui/Button';

/**
 * The dashboard's card. This used to be a second, slightly different
 * implementation of `<Card>` — and it emitted `.widget-icon`,
 * `.widget-actions` and `.widget-action-btn`, none of which existed in any
 * stylesheet, so the "+" on Goals and Social rendered as bare inherited text.
 *
 * It is now a thin adapter over `<Card>`: it normalises the icon (themes hand
 * back elements, a few widgets hand back components) and turns the
 * `onAction` shorthand into a real labelled `<Button>`.
 *
 * span: 2 lets a high-signal widget claim two columns of the masonry grid;
 * span: 3 makes it a full-width row.
 */
const WidgetCard = ({
    children,
    title,
    icon: Icon,
    className = '',
    actions,
    onAction,
    actionIcon = '+',
    actionLabel,
    scroll = false,
    span = 1,
    ...rest
}) => {
    const iconNode = typeof Icon === 'function' ? <Icon /> : Icon;

    const headerActions =
        actions || onAction ? (
            <>
                {actions}
                {onAction && (
                    <Button
                        icon
                        size="sm"
                        label={actionLabel || (title ? `Add to ${title}` : 'Add')}
                        onClick={onAction}
                    >
                        {actionIcon}
                    </Button>
                )}
            </>
        ) : null;

    const spanClass = span >= 3 ? 'widget--span-full' : span === 2 ? 'widget--span-2' : '';
    const classes = [spanClass, className].filter(Boolean).join(' ');

    return (
        <Card
            title={title}
            icon={iconNode}
            actions={headerActions}
            interactive
            scroll={scroll}
            className={classes}
            {...rest}
        >
            {children}
        </Card>
    );
};

export default WidgetCard;
