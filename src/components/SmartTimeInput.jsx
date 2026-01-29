import React, { useState, useEffect, useRef } from 'react';
import { GiClockwork } from 'react-icons/gi';

const SmartTimeInput = ({ value, onChange, onBlur }) => {
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

    // Filter options based on input if it resembles a partial time
    const filteredOptions = inputValue && !value // only filter if typing fresh
        ? timeOptions.filter(t => t.startsWith(inputValue))
        : timeOptions;

    // Actually, simple dropdown usage is better
    const displayOptions = timeOptions;

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', borderRadius: '4px', padding: '0 4px' }}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="--:--"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-main)',
                        padding: '4px',
                        width: '60px',
                        fontSize: '0.9rem',
                        fontFamily: 'monospace',
                        outline: 'none'
                    }}
                />
                <GiClockwork style={{ opacity: 0.5, cursor: 'pointer' }} onClick={() => setIsOpen(!isOpen)} />
            </div>

            {isOpen && (
                <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    width: '100px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-dim)',
                    zIndex: 1000,
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                    {displayOptions.map(time => (
                        <li
                            key={time}
                            onClick={() => {
                                setInputValue(time);
                                onChange(time);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '4px 8px',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                fontSize: '0.9rem',
                                background: time === value ? 'var(--accent-gold-dim)' : 'transparent'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = time === value ? 'var(--accent-gold-dim)' : 'transparent'}
                        >
                            {time}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SmartTimeInput;
