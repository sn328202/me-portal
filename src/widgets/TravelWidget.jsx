import React from 'react';
import { GiCompass, GiCalendar } from 'react-icons/gi';
import { Link } from 'react-router-dom';
import WidgetCard from '../components/WidgetCard';
import { useAtlas } from '../hooks/useAtlas';
import '../styles/TravelWidget.css';

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
                <div className="travel-container">
                    <div className="travel-countdown">
                        {calculateDaysAway(nextTrip.start_date)}
                    </div>
                    <div className="travel-label">Days Until Departure</div>

                    <div className="travel-destination">{nextTrip.destination}</div>
                    <div className="travel-date">{new Date(nextTrip.start_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>

                    <Link to="/atlas" className="travel-atlas-link">
                        Open Atlas
                    </Link>
                </div>
            ) : (
                <div className="travel-empty">
                    <p>{loading ? 'Consulting maps...' : 'No expeditions currently chartered.'}</p>
                    <Link to="/atlas" className="travel-empty-link">Visit Map Room</Link>
                </div>
            )}
        </WidgetCard>
    );
};

export default TravelWidget;
