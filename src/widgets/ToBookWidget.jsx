import React from 'react';
import { Link } from 'react-router-dom';
import { GiRotaryPhone } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import EmptyState from '../components/EmptyState';
import { useToBook } from '../hooks/useToBook';
import { describeToBook } from '../utils/toBook';
import '../styles/ToBookWidget.css';

/**
 * The phone calls, in the order they have to happen.
 *
 * A day says what is still to book on that day and a trip says it for that
 * trip, but the question she actually asks is "what have I not booked *yet*"
 * — and that spans every trip and every loose day at once. Answering it meant
 * opening each of them in turn and remembering.
 *
 * Each line goes to the day it is on, because the next thing after noticing
 * is usually looking at what is around it. And each can be crossed off from
 * here, because a list of calls you cannot tick is a list you stop using.
 */
const ToBookWidget = () => {
    const { items, loading, error, markBooked } = useToBook();

    return (
        <WidgetCard title="Still to book" icon={GiRotaryPhone} span={items.length ? 2 : 1}>
            {error && <p className="tobook__error" role="alert">{error}</p>}

            {items.length === 0 ? (
                <EmptyState
                    icon={<GiRotaryPhone />}
                    message={loading ? 'Checking…' : 'Nothing waiting on a phone call.'}
                />
            ) : (
                <>
                    <p className="tobook__count">{describeToBook(items)}</p>

                    <ul className="tobook__list">
                        {items.map((item) => (
                            <li key={item.id} className={`tobook__row is-${item.urgency}`}>
                                <span className="tobook__when">{item.when}</span>

                                <Link
                                    className="tobook__what"
                                    to={item.tripId && item.date
                                        ? `/atlas/${item.tripId}/day/${item.date}`
                                        : '/atlas'}
                                >
                                    <strong>{item.title}</strong>
                                    <em>
                                        {[item.at, item.trip, item.city]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </em>
                                </Link>

                                <button
                                    type="button"
                                    className="tobook__done"
                                    title={`Mark ${item.title} as booked`}
                                    onClick={() => markBooked(item.id)}
                                >
                                    ✓
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </WidgetCard>
    );
};

export default ToBookWidget;
