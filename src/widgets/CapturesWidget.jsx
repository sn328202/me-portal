import React from 'react';
import { GiFeather, GiCancel } from 'react-icons/gi';
import { formatDistanceToNow } from 'date-fns';
import WidgetCard from '../components/WidgetCard';
import EmptyState from '../components/EmptyState';
import WidgetLoading from '../components/WidgetLoading';
import Button from '../components/ui/Button';
import Tag from '../components/ui/Tag';
import { useCaptures } from '../hooks/useCaptures';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/CapturesWidget.css';

/** Where each capture landed, in the app's own vocabulary. */
const ROOM = {
    provisions: 'Provisions',
    todos: 'Tasks',
    treasury_items: 'Treasury',
    atlas_trips: 'Atlas',
    atlas_days: 'Atlas',
    atlas_day_items: 'Atlas',
    atlas_ideas: 'Atlas',
    // Retired rooms, still named here because dictations from before the
    // merge are in the feed and a capture with no room reads as a capture
    // that did nothing. Everything they held is in the Atlas now.
    day_plans: 'Atlas',
    plan_items: 'Atlas',
    spots: 'Atlas',
    plans: 'Atlas',
    library_items: 'Library',
    social_plans: 'Register',
    chores: 'Duty',
    goals: 'Aspirations',
    habits: 'Rituals',
    pantry_ingredients: 'Larder',
    recipes: 'Larder',
    ingredients: 'Larder',
};

const CapturesWidget = () => {
    const { captures, loading, undoCapture } = useCaptures(12);
    const { getLabel } = useTheme();

    const rooms = (actions) => [...new Set((actions || []).map((a) => ROOM[a.table]).filter(Boolean))];

    return (
        <WidgetCard title="Dictations" icon={<GiFeather />} scroll span={2}>
            {loading ? (
                <WidgetLoading />
            ) : captures.length === 0 ? (
                <EmptyState
                    message="Nothing spoken yet."
                    hint="Run the Portal shortcut on your phone and say what you are thinking."
                    icon={<GiFeather />}
                    inline
                />
            ) : (
                <ul className="captures-list">
                    {captures.map((capture) => (
                        <li
                            key={capture.id}
                            className={`capture${capture.undone ? ' capture--undone' : ''}`}
                        >
                            <div className="capture__body">
                                <p className="capture__transcript">{capture.transcript}</p>
                                <p className="capture__summary">
                                    {capture.error && !capture.actions?.length
                                        ? 'Could not file this one.'
                                        : capture.summary}
                                </p>
                                <div className="capture__meta">
                                    {rooms(capture.actions).map((room) => (
                                        <Tag key={room} tone="gold">{room}</Tag>
                                    ))}
                                    <span className="capture__time">
                                        {formatDistanceToNow(new Date(capture.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                            </div>

                            {capture.undone ? (
                                <span className="capture__undone-flag">undone</span>
                            ) : (
                                capture.actions?.length > 0 && (
                                    <Button
                                        icon
                                        size="sm"
                                        label={`Undo: ${capture.summary || capture.transcript}`}
                                        onClick={() => undoCapture(capture)}
                                    >
                                        <GiCancel />
                                    </Button>
                                )
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <p className="captures-foot muted">
                Spoken into {getLabel('greetingDefault') === 'Traveler' ? 'the portal' : 'your portal'} from your phone.
            </p>
        </WidgetCard>
    );
};

export default CapturesWidget;
