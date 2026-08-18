import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import '../styles/GreetingWidget.css';

const GreetingWidget = () => {
    const { user } = useAuth();
    const { getLabel } = useTheme();
    const [date, setDate] = useState(new Date());
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState('');

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

    const getDisplayName = () => {
        const defaultName = getLabel('greetingDefault');
        if (!user) return defaultName;
        if (user.user_metadata?.name) {
            return user.user_metadata.name;
        }
        if (user.user_metadata?.full_name) {
            return user.user_metadata.full_name.split(' ')[0];
        }
        if (user.email) {
            const emailName = user.email.split('@')[0];
            return emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }
        return defaultName;
    };

    const displayName = getDisplayName();

    const handleNameClick = () => {
        setTempName(displayName);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!tempName.trim()) {
            setIsEditing(false);
            return;
        }
        try {
            const { error } = await supabase.auth.updateUser({
                data: { name: tempName }
            });
            if (error) throw error;
            setIsEditing(false);
        } catch (err) {
            console.error("Error updating name:", err);
            setIsEditing(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') setIsEditing(false);
    };

    return (
        <div className="greeting-widget">
            {/* Date as the "Label" */}
            <div className="greeting-date">
                {format(date, 'EEEE, MMMM do')}
            </div>

            {/* Main Greeting */}
            <h2 className="greeting-text">
                {getGreeting()}, <br />
                {isEditing ? (
                    <input
                        autoFocus
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className="greeting-name-input"
                    />
                ) : (
                    <span
                        onClick={handleNameClick}
                        className="greeting-name-display"
                        title="Click to edit name"
                    >
                        {displayName}.
                    </span>
                )}
            </h2>
        </div>
    );
};

export default GreetingWidget;
