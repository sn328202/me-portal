import React from 'react';
import { initials, hueOf } from '../utils/people';

/** Initials in a circle, the same colour for the same name every time. */
const PersonAvatar = ({ name, small = false }) => (
    <span
        className={`circle-avatar${small ? ' circle-avatar--sm' : ''}`}
        style={{ '--avatar-hue': hueOf(name) }}
        aria-hidden="true"
    >
        {initials(name)}
    </span>
);

export default PersonAvatar;
