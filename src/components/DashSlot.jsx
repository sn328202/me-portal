import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GiMove } from 'react-icons/gi';

/**
 * One cell of the dashboard grid.
 *
 * The widget itself no longer decides how much of the page it gets: the slot
 * is the grid item, the widget fills it, and the width comes from her
 * settings. That is also what makes rearranging possible — the thing being
 * dragged is this wrapper, so no widget needs to know it is draggable.
 *
 * Dragging is behind an Arrange mode rather than always on, because these
 * cards are full of things you press: a checkbox on every habit, a text field
 * in each of Today's three groups, a delete on every row. A drag listener over
 * all of that turns "tick a habit" into a gesture the browser has to guess at.
 * In arrange mode the card is covered and inert; out of it, nothing has
 * changed.
 */
const DashSlot = ({ id, span, arranging, label, onResize, children }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: !arranging,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        // The gap it leaves behind should read as a gap, not as a card that
        // has gone strange.
        opacity: isDragging ? 0.4 : undefined,
        zIndex: isDragging ? 2 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`dash-slot dash-slot--${span}${arranging ? ' is-arranging' : ''}`}
        >
            {children}

            {arranging && (
                <div className="dash-slot__grip">
                    {/* The whole cover is the handle: in arrange mode there is
                        nothing else to hit, so a small grip would just be a
                        smaller target for the same gesture. */}
                    <button
                        type="button"
                        className="dash-slot__drag"
                        aria-label={`Move ${label}`}
                        {...attributes}
                        {...listeners}
                    >
                        <GiMove aria-hidden="true" />
                        <span>{label}</span>
                    </button>
                    <button
                        type="button"
                        className="dash-slot__size"
                        aria-label={`${label} is ${span} of 3 columns wide — press to widen`}
                        onClick={() => onResize(id)}
                    >
                        {span} / 3
                    </button>
                </div>
            )}
        </div>
    );
};

export default DashSlot;
