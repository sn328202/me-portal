import React from 'react';
import { parse, startOfDay } from 'date-fns';
import { GiCompass } from 'react-icons/gi';
import { Link, useNavigate } from 'react-router-dom';
import WidgetCard from '../components/WidgetCard';
import EmptyState from '../components/EmptyState';
import Button from '../components/ui/Button';
import { useAtlas } from '../hooks/useAtlas';
import '../styles/TravelWidget.css';

// 'yyyy-MM-dd' strings parse as UTC midnight via new Date(), which renders a day
// early west of Greenwich. Parse them as local dates instead.
const parseLocalDate = (value) => parse(value, 'yyyy-MM-dd', new Date());

const TravelWidget = () => {
    const { trips, loading } = useAtlas();
    const navigate = useNavigate();

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
                        <span className="travel-countdown-value">{calculateDaysAway(nextTrip.start_date)}</span>
                        <span className="travel-label">Days Until Departure</span>
                    </div>

                    <div className="travel-detail">
                        <div className="travel-destination">{nextTrip.destination}</div>
                        <div className="travel-date">
                            {parseLocalDate(nextTrip.start_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                        <Button as={Link} to="/atlas" size="sm" className="travel-atlas-link">
                            Open Atlas
                        </Button>
                    </div>
                </div>
            ) : (
                <EmptyState
                    message={loading ? 'Consulting maps...' : 'No expeditions currently chartered.'}
                    actionLabel="Visit Map Room"
                    onAction={() => navigate('/atlas')}
                    icon={<GiCompass />}
                />
            )}
        </WidgetCard>
    );
};

export default TravelWidget;
