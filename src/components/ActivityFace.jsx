import React, { useState } from 'react';
import { faceFor } from '../utils/dayCard';

/**
 * The picture on a card, when there is no picture.
 *
 * Most places have no usable Google photo — the ones that do have a session
 * URL that expires — so the majority of cards were a title and an address in
 * a column of titles and addresses, and skimming the day meant reading it.
 *
 * An emoji is not a substitute for a photograph. It is a substitute for
 * nothing at all, and against nothing at all it wins easily: the eye finds
 * the dinner on a list of eleven things without reading a word.
 *
 * Guessed from what she called it, and changeable, because the guess is a
 * guess — "The Blue Door" could be a bar, a gallery or a hotel.
 */

/* The set she can choose from. Kinds rather than specifics: this is a picker,
   not a keyboard, and eighteen is already more than anyone scans. */
const FACES = [
    ['🍽️', 'Food'], ['☕', 'Coffee'], ['🥐', 'Breakfast'], ['🍸', 'Drinks'],
    ['🍨', 'Sweet'], ['🛍️', 'Shopping'], ['🖼️', 'Art'], ['🏛️', 'Sights'],
    ['🛕', 'Temple'], ['🏖️', 'Beach'], ['🥾', 'Walk'], ['🌿', 'Outdoors'],
    ['🌅', 'A view'], ['🎟️', 'A show'], ['🎨', 'A class'], ['🧖', 'Spa'],
    ['🛏️', 'Stay'], ['✈️', 'Travel'], ['🚗', 'Drive'], ['😌', 'Rest'],
];

const ActivityFace = ({ item, onChange, className = '' }) => {
    const [open, setOpen] = useState(false);
    const face = item.icon || faceFor(item.activity || item.title, item.kind);

    return (
        <span className={`face ${className}`}>
            <button
                type="button"
                className="face__btn"
                aria-label={`Change the icon for ${item.activity || item.title || 'this'}`}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <span aria-hidden="true">{face}</span>
            </button>

            {open && (
                <>
                    {/* Anywhere else closes it, which is what every menu on
                        every page does and what nobody has to be told. */}
                    <button
                        type="button"
                        className="face__scrim"
                        aria-label="Close"
                        onClick={() => setOpen(false)}
                    />
                    <div className="face__menu" role="menu">
                        {FACES.map(([emoji, name]) => (
                            <button
                                key={emoji}
                                type="button"
                                role="menuitem"
                                className={`face__option${face === emoji ? ' is-on' : ''}`}
                                title={name}
                                onClick={() => { onChange(emoji); setOpen(false); }}
                            >
                                <span aria-hidden="true">{emoji}</span>
                                <span className="face__name">{name}</span>
                            </button>
                        ))}
                        {/* Back to the guess, which is often right and is the
                            only option that keeps up if she renames the card. */}
                        <button
                            type="button"
                            role="menuitem"
                            className="face__option face__option--clear"
                            onClick={() => { onChange(null); setOpen(false); }}
                        >
                            <span className="face__name">Guess it for me</span>
                        </button>
                    </div>
                </>
            )}
        </span>
    );
};

export default ActivityFace;
