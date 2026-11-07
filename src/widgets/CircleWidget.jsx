import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GiThreeFriends } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import EmptyState from '../components/EmptyState';
import { usePeople } from '../hooks/usePeople';
import { upcomingBirthdays, catchUpList, birthdayLabel, inDaysLabel, sinceLabel } from '../utils/people';
import { todayLocal } from '../utils/today';
import '../styles/People.css';

/**
 * The Circle on the dashboard: birthdays in the next three weeks, and anyone
 * whose "keep in touch" gap has run out. Both link into the room.
 */
const CircleWidget = () => {
    const { people, lastBy, loading } = usePeople();
    const today = todayLocal();
    const soon = useMemo(() => upcomingBirthdays(people, today, 21), [people, today]);
    const overdue = useMemo(
        () => catchUpList(people, lastBy, today).filter((r) => r.overdue).slice(0, 4),
        [people, lastBy, today],
    );

    return (
        <WidgetCard title="The Circle" icon={GiThreeFriends}>
            {soon.length === 0 && overdue.length === 0 ? (
                <EmptyState icon={<GiThreeFriends />}
                    message={loading ? 'Gathering everyone…' : 'No birthdays in the next three weeks.'} />
            ) : (
                <div className="circle-widget">
                    {soon.length > 0 && (
                        <ul>
                            {soon.map(({ person, next }) => (
                                <li key={person.id} className={next.days <= 3 ? 'is-soon' : ''}>
                                    <span>🎂</span>
                                    <strong>{person.name}</strong>
                                    <em>{birthdayLabel(person)} · {inDaysLabel(next.days)}</em>
                                </li>
                            ))}
                        </ul>
                    )}
                    {overdue.length > 0 && (
                        <ul>
                            {overdue.map((r) => (
                                <li key={r.person.id}>
                                    <span>💬</span>
                                    <strong>{r.person.name}</strong>
                                    <em>{r.last ? `last ${sinceLabel(r.last.happened_on, today)}` : 'due a catch-up'}</em>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            <Link className="circle-widget__more" to="/circle">Open the Circle →</Link>
        </WidgetCard>
    );
};

export default CircleWidget;
