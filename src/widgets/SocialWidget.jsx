import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import WidgetCard from '../components/WidgetCard';
import { useSocial } from '../hooks/useSocial';
import '../styles/SocialWidget.css';

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
        <WidgetCard title={getLabel('social')} icon={getIcon('social')} actionIcon={isAdding ? null : '+'} onAction={() => setIsAdding(true)}>
            {isAdding && (
                <form onSubmit={handleAdd} className="social-form">
                    <input
                        placeholder="Who?"
                        value={who} onChange={e => setWho(e.target.value)}
                        className="social-input"
                    />
                    <input
                        placeholder="What?"
                        value={what} onChange={e => setWhat(e.target.value)}
                        className="social-input"
                    />
                    <input
                        type="date"
                        value={when} onChange={e => setWhen(e.target.value)}
                        className="social-input-date"
                    />
                    <div className="social-form-controls">
                        <button type="submit" className="social-rsvp-btn">RSVP</button>
                        <button type="button" onClick={() => setIsAdding(false)} className="social-cancel-btn">Cancel</button>
                    </div>
                </form>
            )}

            <div className="social-list-container">
                {events.length === 0 && !isAdding && !loading && (
                    <div className="social-empty">
                        The calendar is clear.
                    </div>
                )}
                {events.map(plan => (
                    <div key={plan.id} className="social-event-item">
                        <div>
                            <div className="social-event-who">{plan.who}</div>
                            <div className="social-event-what">{plan.what}</div>
                            {plan.when_date && <div className="social-event-date">{new Date(plan.when_date).toLocaleDateString()}</div>}
                        </div>
                        <button onClick={() => deleteEvent(plan.id)} className="social-delete-btn">×</button>
                    </div>
                ))}
            </div>
        </WidgetCard>
    );
};

export default SocialWidget;
