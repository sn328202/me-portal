import React from 'react';
import { GiCompass, GiCalendar } from 'react-icons/gi';
import { Link } from 'react-router-dom';
import WidgetCard from '../components/WidgetCard';
import { useAtlas } from '../hooks/useAtlas';

const TravelWidget = () => {
    const { trips, loading } = useAtlas();

    // Filter future trips logic is similar, but use trips from hook
    const nextTrip = trips
        .filter(t => t.start_date && new Date(t.start_date) > new Date())
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0];

    const calculateDaysAway = (dateString) => {
        const diff = new Date(dateString) - new Date();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    return (
        <WidgetCard title="Next Expedition" icon={GiCompass}>
            {nextTrip ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <div style={{
                        fontSize: '2rem', fontFamily: 'var(--font-display)', color: 'var(--text-gold)', marginBottom: '0.5rem'
                    }}>
                        {calculateDaysAway(nextTrip.start_date)}
                    </div>
                    <div style={{ textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Days Until Departure</div>

                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>{nextTrip.destination}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{new Date(nextTrip.start_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>

                    <Link to="/atlas" style={{
                        display: 'inline-block', marginTop: '1.5rem',
                        padding: '0.5rem 1rem', border: '1px solid var(--text-gold)',
                        color: 'var(--text-gold)', textDecoration: 'none', fontSize: '0.8rem'
                    }}>
                        Open Atlas
                    </Link>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    <p>{loading ? 'Consulting maps...' : 'No expeditions currently chartered.'}</p>
                    <Link to="/atlas" style={{ color: 'var(--text-gold)', textDecoration: 'underline' }}>Visit Map Room</Link>
                </div>
            )}
        </WidgetCard>
    );
};

export default TravelWidget;
