import React from 'react';
import { stateOf, nextState, labelOf, titleOf } from '../utils/bookingState';
import '../styles/BookedChip.css';

/**
 * Whether a thing needs booking, and whether it has been.
 *
 * A day of plans is three lists wearing the same clothes: the parts nobody
 * has to ring up, the parts that still need ringing up, and the parts already
 * held. Only the middle one is a task, and it is the only one that shouts —
 * everything else stays quiet, because a column of cards each announcing its
 * state is a column of alarms.
 *
 * A stop that came from the Table Book is booked without being asked and
 * cannot be cycled: it *is* a reservation. The booking is the fact and this
 * is only the label on it.
 */
const BookedChip = ({ stop, label = 'this', onChange }) => {
    const state = stateOf(stop);
    const fixed = Boolean(stop?.booked_id);
    const classes = `booked booked--${state}${fixed ? ' booked--fixed' : ''}`;

    // Nothing to change it with — an overview showing the state rather than
    // offering it. A button that does nothing when pressed is worse than a
    // word.
    if (!onChange || fixed) {
        return (
            <span
                className={`${classes} booked--fixed`}
                title={fixed
                    ? `${label || 'This'} came from the Table Book — it is a real booking`
                    : titleOf(state)}
            >
                {labelOf(state)}
            </span>
        );
    }

    return (
        <button
            type="button"
            className={classes}
            title={`${label || 'This'}: ${titleOf(state)}`}
            aria-label={`${label || 'This'} — ${labelOf(state)}`}
            onClick={() => onChange(nextState(state))}
        >
            {labelOf(state)}
        </button>
    );
};

export default BookedChip;
