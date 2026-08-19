import React, { useState } from 'react';
import { parse } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';
import WidgetCard from '../components/WidgetCard';
import Button from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
import { useSocial } from '../hooks/useSocial';
import '../styles/SocialWidget.css';

// 'yyyy-MM-dd' strings parse as UTC midnight via new Date(), which renders a day
// early west of Greenwich. Parse them as local dates instead.
const parseLocalDate = (value) => parse(value, 'yyyy-MM-dd', new Date());

const SocialWidget = () => {
    const { events, addEvent, deleteEvent, loading } = useSocial();
    const { getLabel, getIcon } = useTheme();
    const [who, setWho] = useState('');
    const [what, setWhat] = useState('');
    const [when, setWhen] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = (e) => {
        e.preventDefault();
        if (!who || !what) return;
        addEvent({ who, what, when, where: '' }); // Location optional for now
        setWho('');
        setWhat('');
        setWhen('');
        setIsAdding(false);
    };

    return (
        <WidgetCard
            title={getLabel('social')}
            icon={getIcon('social')}
            scroll
            actionIcon={isAdding ? '×' : '+'}
            actionLabel={isAdding ? 'Cancel new plan' : `Add to ${getLabel('social')}`}
            onAction={() => setIsAdding(!isAdding)}
        >
            {isAdding && (
                <form onSubmit={handleAdd} className="social-form">
                    <input
                        placeholder="Who?"
                        aria-label="Who"
                        value={who} onChange={e => setWho(e.target.value)}
                        className="social-input"
                    />
                    <input
                        placeholder="What?"
                        aria-label="What"
                        value={what} onChange={e => setWhat(e.target.value)}
                        className="social-input"
                    />
                    <input
                        type="date"
                        aria-label="When"
                        value={when} onChange={e => setWhen(e.target.value)}
                        className="social-input-date"
                    />
                    <div className="social-form-controls">
                        <Button type="submit" variant="solid" size="sm" className="social-rsvp-btn">RSVP</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
                    </div>
                </form>
            )}

            <div className="social-list-container">
                {events.length === 0 && !isAdding && !loading && (
                    <EmptyState message="The calendar is clear." icon={getIcon('social')} inline />
                )}
                {events.map(plan => (
                    <div key={plan.id} className="social-event-item">
                        <div>
                            <div className="social-event-who">{plan.who}</div>
                            <div className="social-event-what">{plan.what}</div>
                            {plan.when_date && <div className="social-event-date">{parseLocalDate(plan.when_date).toLocaleDateString()}</div>}
                        </div>
                        <Button
                            icon
                            size="sm"
                            className="social-delete-btn"
                            onClick={() => deleteEvent(plan.id)}
                            label={`Delete plan with ${plan.who}`}
                        >
                            ×
                        </Button>
                    </div>
                ))}
            </div>
        </WidgetCard>
    );
};

export default SocialWidget;
