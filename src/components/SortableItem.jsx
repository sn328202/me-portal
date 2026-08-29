import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Sortable wrapper. The drag listeners deliberately do NOT go on this
 * container — it holds buttons and links, and dnd-kit's attributes turn a
 * container into role="button" with tabIndex=0. `children` is a function so
 * the row can put them on a real handle instead.
 */
const SortableItem = ({ item, children }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={isDragging ? 'sortable is-dragging' : 'sortable'}
        >
            {children({ ...attributes, ...listeners, ref: setActivatorNodeRef })}
        </div>
    );
};

export default SortableItem;
