import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../hooks/useSettings';
import '../styles/StatusConsole.css';

const StatusConsole = () => {
    const { getLabel, getIcon } = useTheme();
    const { settings, updateSetting, loading } = useSettings();
    const url = settings.statusUrl || '';
    const [editMode, setEditMode] = useState(false);

    // Settings load asynchronously, so only decide on edit mode once they are in.
    useEffect(() => {
        if (loading) return;
        setEditMode(!settings.statusUrl);
    }, [loading, settings.statusUrl]);

    const handleSave = async (e) => {
        e.preventDefault();
        const input = e.target.elements.urlUrl.value;
        await updateSetting('statusUrl', input);
        setEditMode(false);
    };

    return (
        <div className="status-console">
            {/* Header / Controls */}
            <div className="status-header">
                <h3 className="status-title">
                    {getIcon('status')} {getLabel('status')}
                </h3>
                <button
                    onClick={() => setEditMode(!editMode)}
                    className="status-config-btn"
                >
                    {editMode ? 'Cancel' : getLabel('statusConfig')}
                </button>
            </div>

            {/* Content Area */}
            <div className="status-content-area">
                {editMode ? (
                    <div className="status-config-overlay">
                        <form onSubmit={handleSave} className="status-form">
                            <p>Enter the URL of your Dashboard (Retool, Google Data Studio, etc.)</p>
                            <input
                                name="urlUrl"
                                defaultValue={url}
                                placeholder="https://..."
                                type="url"
                                className="status-input"
                                required
                            />
                            <button type="submit" className="status-submit-btn">
                                {getLabel('statusEstablish')}
                            </button>
                        </form>
                    </div>
                ) : (
                    <iframe
                        src={url}
                        className="status-iframe"
                        title="Status Dashboard"
                    />
                )}
            </div>
        </div>
    );
};

export default StatusConsole;
