import React from 'react';
import { GiCalendar } from 'react-icons/gi';
import { format, addDays, startOfDay } from 'date-fns';

const DaySelector = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Calculate dates for the next 7 days to match MealPlanner logic
    const today = startOfDay(new Date());
    const weekDates = {};
    for (let i = 0; i < 7; i++) {
        const date = addDays(today, i);
        const dayName = format(date, 'EEEE');
        weekDates[dayName] = format(date, 'MMM d');
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}
            onClick={onClose}
        >
            <div style={{
                background: 'var(--bg-panel)',
                border: 'var(--border-double)',
                padding: 'var(--space-lg)',
                minWidth: '300px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-md)'
            }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{
                    marginBottom: 'var(--space-md)',
                    borderBottom: '1px solid var(--border-gold)',
                    paddingBottom: 'var(--space-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--space-sm)',
                    color: 'var(--text-gold)'
                }}>
                    <GiCalendar size={24} />
                    <h3 className="box-header" style={{ margin: 0, fontSize: '1.2rem' }}>Select Day</h3>
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                    {days.map(day => (
                        <button
                            key={day}
                            onClick={() => onSelect(day)}
                            style={{
                                padding: '12px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--border-dim)',
                                color: 'var(--text-main)',
                                fontFamily: 'var(--font-display)',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'var(--accent-crimson)';
                                e.currentTarget.style.borderColor = 'var(--accent-crimson)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                e.currentTarget.style.borderColor = 'var(--border-dim)';
                            }}
                        >
                            <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <span>{day}</span>
                                <span style={{ fontSize: '0.8rem', opacity: 0.6, letterSpacing: '0px' }}>{weekDates[day]}</span>
                            </span>
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    style={{
                        marginTop: 'var(--space-md)',
                        color: 'var(--text-muted)',
                        background: 'none',
                        border: 'none',
                        textDecoration: 'underline',
                        cursor: 'pointer'
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default DaySelector;
