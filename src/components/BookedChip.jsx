import React from 'react';
import '../styles/BookedChip.css';

/**
 * Whether the thing is actually held yet.
 *
 * A day of plans is two different lists wearing the same clothes: the parts
 * that exist because someone rang up and held them, and the parts that are
 * still only intentions. The card looked identical either way, so the
 * question "what have I not booked yet" could only be answered by
 * remembering.
 *
 * Not booked is the default, because most things start as an intention. A
 * stop that came from the Table Book is booked and says so without being
 * asked — it *is* a reservation — and cannot be toggled off here, because the
 * booking is the fact and this is only the label on it.
 */
const BookedChip = ({ booked, fromBooking = false, label = 'this', onChange }) => {
    /* Nothing to change it with — an overview showing the state rather than
       offering it. A button that does nothing when pressed is worse than a
       word. */
    if (!onChange) {
        return (
            <span
                className={`booked booked--fixed${booked ? ' booked--held' : ''}`}
                title={booked ? 'Booked' : 'Still needs booking'}
            >
                {booked ? '✓ booked' : 'to book'}
            </span>
        );
    }

    if (fromBooking) {
        return (
            <span
                className="booked booked--held booked--fixed"
                title="This came from the Table Book — it is a real booking"
            >
                ✓ booked
            </span>
        );
    }

    return (
        <button
            type="button"
            className={`booked${booked ? ' booked--held' : ''}`}
            aria-pressed={Boolean(booked)}
            title={booked
                ? `${label || 'This'} is booked — click if it is not after all`
                : `${label || 'This'} still needs booking — click when it is held`}
            onClick={() => onChange?.(!booked)}
        >
            {booked ? '✓ booked' : 'to book'}
        </button>
    );
};

export default BookedChip;
