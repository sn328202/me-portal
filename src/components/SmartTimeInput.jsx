import React, { useState, useEffect, useRef } from 'react';
import { GiClockwork } from 'react-icons/gi';
import Button from './ui/Button';

/**
 * Free-text time entry with a 15-minute quick list. Used only by The
 * Daydream, so its styling lives in styles/DayPlanner.css.
 */
const SmartTimeInput = ({ value, onChange, onBlur, label = 'Start time' }) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Sync internal state with prop
    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                handleBlur();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [inputValue]);

    const parseTime = (input) => {
        if (!input) return null;

        let normalized = input.toLowerCase().replace(/\s/g, '');
        let hours = 0;
        let minutes = 0;

        // RegEx patterns
        const simpleTime = /^(\d{1,2}):?(\d{2})?$/; // 14:30, 1430, 9
        const ampmTime = /^(\d{1,2}):?(\d{2})?(am|pm)$/; // 5pm, 5:30pm, 2am

        if (ampmTime.test(normalized)) {
            const match = normalized.match(ampmTime);
            hours = parseInt(match[1]);
            minutes = match[2] ? parseInt(match[2]) : 0;
            const period = match[3];

            if (period === 'pm' && hours < 12) hours += 12;
            if (period === 'am' && hours === 12) hours = 0;
        } else if (simpleTime.test(normalized)) {
            const match = normalized.match(simpleTime);
            hours = parseInt(match[1]);
            minutes = match[2] ? parseInt(match[2]) : 0;
        } else {
            return null; // Invalid format
        }

        // Validate
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

        // Format to HH:mm
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const handleBlur = () => {
        const parsed = parseTime(inputValue);
        if (parsed) {
            setInputValue(parsed);
            if (parsed !== value) onChange(parsed);
        } else {
            // Revert or keep as is? Let's revert to valid val if invalid
            // But if empty, keep empty
            if (inputValue === '') {
                onChange(null);
            } else if (value) {
                setInputValue(value);
            }
        }
        if (onBlur) onBlur();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            setIsOpen(false);
            handleBlur();
        }
        if (e.key === 'ArrowDown') {
            setIsOpen(true);
        }
    };

    const generateTimeOptions = () => {
        const options = [];
        for (let i = 0; i < 24; i++) {
            for (let j = 0; j < 60; j += 15) {
                const hour = i.toString().padStart(2, '0');
                const minute = j.toString().padStart(2, '0');
                options.push(`${hour}:${minute}`);
            }
        }
        return options;
    };

    const timeOptions = generateTimeOptions();

    const displayOptions = timeOptions;

    return (
        <div ref={containerRef} className="time-input">
            <div className="time-input__control">
                <input
                    type="text"
                    className="time-input__field"
                    aria-label={label}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="--:--"
                />
                <Button
                    icon
                    size="sm"
                    label={isOpen ? 'Hide time options' : 'Show time options'}
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <GiClockwork />
                </Button>
            </div>

            {isOpen && (
                <ul className="time-input__list">
                    {displayOptions.map(time => (
                        <li key={time}>
                            <button
                                type="button"
                                className={`time-input__option${time === value ? ' is-current' : ''}`}
                                onClick={() => {
                                    setInputValue(time);
                                    onChange(time);
                                    setIsOpen(false);
                                }}
                            >
                                {time}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SmartTimeInput;
