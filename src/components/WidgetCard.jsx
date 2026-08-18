import React from 'react';

const WidgetCard = ({
    children,
    title,
    icon: Icon,
    className = '',
    actions,
    onAction,
    actionIcon = '+',
    style = {}
}) => {
    return (
        <div className={`widget-card ${className}`} style={style}>
            {(title || actions || Icon || onAction) && (
                <div className="widget-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {Icon && <span className="widget-icon">{typeof Icon === 'function' ? <Icon /> : Icon}</span>}
                        {title && <h3 className="widget-title">{title}</h3>}
                    </div>
                    <div className="widget-actions">
                        {actions}
                        {onAction && (
                            <button onClick={onAction} className="widget-action-btn">
                                {actionIcon}
                            </button>
                        )}
                    </div>
                </div>
            )}
            <div className="widget-content">
                {children}
            </div>
        </div>
    );
};

export default WidgetCard;
