import React from 'react';

/** One stat tile. There were three, including one defined inside a page file. */
const Stat = ({ value, label, icon, className = '', ...rest }) => (
    <div className={['stat', className].filter(Boolean).join(' ')} {...rest}>
        {icon && <span className="stat__icon">{icon}</span>}
        <span className="stat__value">{value}</span>
        <span className="stat__label">{label}</span>
    </div>
);

export default Stat;
