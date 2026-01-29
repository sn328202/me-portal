import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import WidgetCard from '../components/WidgetCard';

const GreetingWidget = () => {
    const [date, setDate] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setDate(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const getGreeting = () => {
        const hour = date.getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="greeting-widget" style={{ padding: 'var(--space-lg) 0' }}>
            {/* Date as the "Label" */}
            <div className="box-header" style={{ marginBottom: 'var(--space-md)', color: 'var(--text-muted)' }}>
                {format(date, 'EEEE, MMMM do')}
            </div>

            {/* Main Greeting */}
            <h2 style={{
                fontSize: '4rem',
                margin: 0,
                fontWeight: 400,
                fontFamily: 'var(--font-display)',
                color: 'var(--text-main)',
                lineHeight: 1
            }}>
                {getGreeting()}, <br />
                <span style={{ color: 'var(--text-gold)', fontStyle: 'italic' }}>Neha.</span>
            </h2>
        </div>
    );
};

export default GreetingWidget;
