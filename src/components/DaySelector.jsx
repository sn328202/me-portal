import React from 'react';
import { GiCalendar } from 'react-icons/gi';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { Button, Modal } from './ui';

/**
 * Which day to cook something on.
 *
 * Was a fixed Monday-to-Sunday list that handed back a weekday *name*, so a
 * meal planned on a Thursday for "Monday" could mean the Monday just gone.
 * It now offers the next seven days in the order they actually arrive, and
 * hands back a date.
 */
const DaySelector = ({ isOpen, onClose, onSelect }) => {
    const today = startOfDay(new Date());

    const days = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i);
        return {
            iso: format(date, 'yyyy-MM-dd'),
            name: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(date, 'EEEE'),
            when: format(date, 'MMM d'),
            isToday: isSameDay(date, today),
        };
    });

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={<><GiCalendar /> Which day?</>}
            footer={<Button variant="ghost" onClick={onClose}>Cancel</Button>}
        >
            <div className="day-selector">
                {days.map(({ iso, name, when, isToday }) => (
                    <Button
                        key={iso}
                        block
                        className={`day-selector__day${isToday ? ' is-today' : ''}`}
                        onClick={() => onSelect(iso)}
                    >
                        <span>{name}</span>
                        <span className="day-selector__date">{when}</span>
                    </Button>
                ))}
            </div>
        </Modal>
    );
};

export default DaySelector;
