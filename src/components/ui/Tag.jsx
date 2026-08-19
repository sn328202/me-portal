import React from 'react';

/** One pill. There were four, differing in radius, face and colour logic. */
const Tag = ({ tone = 'default', icon, className = '', children, ...rest }) => (
    <span
        className={['tag', tone !== 'default' ? `tag--${tone}` : '', className]
            .filter(Boolean)
            .join(' ')}
        {...rest}
    >
        {icon}
        {children}
    </span>
);

export default Tag;
