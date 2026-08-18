import React from 'react';
import { parse, startOfDay } from 'date-fns';
import { GiCompass, GiCalendar } from 'react-icons/gi';
import { Link } from 'react-router-dom';
import WidgetCard from '../components/WidgetCard';
import { useAtlas } from '../hooks/useAtlas';
import '../styles/TravelWidget.css';

// 'yyyy-MM-dd' strings parse as UTC midnight via new Date(), which renders a day
// early west of Greenwich. Parse them as local dates instead.
const parseLocalDate = (value) => parse(value, 'yyyy-MM-dd', new Date());

const TravelWidget = () => {
    const { trips, loading } = useAtlas();

    // Filter future trips logic is similar, but use trips from hook
    const today = startOfDay(new Date());
    const nextTrip = trips
        .filter(t => t.start_date && parseLocalDate(t.start_date) >= today)
        .sort((a, b) => parseLocalDate(a.start_date) - parseLocalDate(b.start_date))[0];

    const calculateDaysAway = (dateString) => {
        const diff = parseLocalDate(dateString) - startOfDay(new Date());
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
                    <div className="travel-date">{parseLocalDate(nextTrip.start_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>

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
