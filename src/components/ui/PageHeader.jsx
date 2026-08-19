import React from 'react';

/**
 * One page header. There were seven, four of them byte-identical copies of
 * `.box-header` + `fontSize: 2rem` + a double-rule bottom border.
 */
const PageHeader = ({ title, icon, subtitle, actions, children }) => (
    <header className="page-header">
        <div className="page-header__titles">
            <h1 className="page-header__title">
                {icon && <span className="page-header__icon">{icon}</span>}
                {title}
            </h1>
            {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
        </div>
        {(actions || children) && (
            <div className="page-header__actions">
                {actions}
                {children}
            </div>
        )}
    </header>
);

export default PageHeader;
