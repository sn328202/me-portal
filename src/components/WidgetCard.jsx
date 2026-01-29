import React from 'react';

const WidgetCard = ({ children, title, className = '', actions }) => {
    return (
        <div className={`widget-card ${className}`}>
            {(title || actions) && (
                <div className="widget-header">
                    {title && <h3 className="widget-title">{title}</h3>}
                    {actions && <div>{actions}</div>}
                </div>
            )}
            <div className="widget-content">
                {children}
            </div>
        </div>
    );
};

export default WidgetCard;
