import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import WidgetCard from '../components/WidgetCard';
import Button from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
import { useHobbies } from '../hooks/useHobbies';
import ProgressBar from '../components/gamification/ProgressBar';
import '../styles/HobbiesWidget.css';

const HobbiesWidget = () => {
    const { hobbies, addHobby, toggleStatus, deleteHobby, logSession, loading } = useHobbies();
    const { getLabel, getIcon } = useTheme();
    const [newItem, setNewItem] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        addHobby(newItem);
        setNewItem('');
    };

    return (
        <WidgetCard title={getLabel('hobbies')} icon={getIcon('hobbies')} className="hobbies-widget" scroll>
            <form onSubmit={handleAdd} className="hobby-form">
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder={loading ? 'Loading...' : `New ${getLabel('hobbies').toLowerCase()}...`}
                    aria-label={`New ${getLabel('hobbies').toLowerCase()}`}
                    disabled={loading}
                    className="hobby-input"
                />
                <Button icon size="sm" type="submit" className="hobby-add-btn" label={`Add ${getLabel('hobbies').toLowerCase()}`}>+</Button>
            </form>

            {hobbies.length === 0 && !loading && (
                <EmptyState
                    message={`No ${getLabel('hobbies').toLowerCase()} taken up yet.`}
                    icon={getIcon('hobbies')}
                    inline
                />
            )}

            <div className="hobby-grid">
                {hobbies.map(hobby => {
                    // Check if tracked as active today (simple check for now)
                    const isActiveToday = hobby.last_session && new Date(hobby.last_session).toDateString() === new Date().toDateString();

                    return (
                        <div key={hobby.id} className={`hobby-item ${hobby.status === 'Active' ? 'active' : ''}`}>
                            <div className="hobby-header">
                                <span className="hobby-name">
                                    {hobby.name}
                                </span>
                                <Button
                                    icon
                                    size="sm"
                                    className="hobby-delete-btn"
                                    onClick={() => deleteHobby(hobby.id)}
                                    label={`Delete ${hobby.name}`}
                                >
                                    ×
                                </Button>
                            </div>
                            <div className="hobby-actions">
                                <button
                                    onClick={() => toggleStatus(hobby.id)}
                                    className="hobby-action-btn"
                                >
                                    {hobby.status}
                                </button>
                                {hobby.status === 'Active' && (
                                    <button
                                        onClick={() => logSession(hobby.id)}
                                        disabled={isActiveToday}
                                        className={`hobby-log-btn ${isActiveToday ? 'logged' : ''}`}
                                    >
                                        {isActiveToday ? 'Logged' : 'Log Session'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="hobby-progress-container">
                <ProgressBar
                    current={hobbies.filter(h => h.last_session && new Date(h.last_session).toDateString() === new Date().toDateString()).length}
                    max={hobbies.filter(h => h.status === 'Active').length}
                    icon={getIcon('hobbies')}
                    color="var(--accent-gold)"
                />
            </div>
        </WidgetCard>
    );
};

export default HobbiesWidget;
