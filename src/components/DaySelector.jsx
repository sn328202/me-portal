import React from 'react';
import { GiCalendar } from 'react-icons/gi';
import { format, addDays, startOfDay } from 'date-fns';
import { Button, Modal } from './ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DaySelector = ({ isOpen, onClose, onSelect }) => {
    // Calculate dates for the next 7 days to match MealPlanner logic
    const today = startOfDay(new Date());
    const weekDates = {};
    for (let i = 0; i < 7; i++) {
        const date = addDays(today, i);
        weekDates[format(date, 'EEEE')] = format(date, 'MMM d');
    }

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={<><GiCalendar /> Select Day</>}
            footer={<Button variant="ghost" onClick={onClose}>Cancel</Button>}
        >
            <div className="day-selector">
                {DAYS.map(day => (
                    <Button
                        key={day}
                        block
                        className="day-selector__day"
                        onClick={() => onSelect(day)}
                    >
                        <span>{day}</span>
                        <span className="day-selector__date">{weekDates[day]}</span>
                    </Button>
                ))}
            </div>
        </Modal>
    );
};

export default DaySelector;
