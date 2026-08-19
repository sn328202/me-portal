import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../hooks/useSettings';
import WidgetCard from '../components/WidgetCard';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import EmptyState from '../components/EmptyState';
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

    // The embed URL is user-entered. Anything that isn't absolute http(s)
    // never reaches the iframe.
    const safeUrl = /^https?:\/\//i.test(url || '') ? url : '';

    return (
        <WidgetCard
            title={getLabel('status')}
            icon={getIcon('status')}
            span={2}
            className="status-console"
            actions={
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditMode(!editMode)}
                    label={editMode ? 'Cancel' : getLabel('statusConfig')}
                >
                    {editMode ? 'Cancel' : getLabel('statusConfig')}
                </Button>
            }
        >
            <div className="status-content-area">
                {editMode ? (
                    <form onSubmit={handleSave} className="status-form">
                        <Field
                            label="Dashboard URL"
                            hint="Retool, Google Data Studio, Grafana — anything embeddable."
                        >
                            <input
                                name="urlUrl"
                                defaultValue={url}
                                placeholder="https://..."
                                type="url"
                                className="input"
                                required
                            />
                        </Field>
                        <Button type="submit" variant="primary">
                            {getLabel('statusEstablish')}
                        </Button>
                    </form>
                ) : !safeUrl ? (
                    <EmptyState
                        message={`No ${getLabel('status').toLowerCase()} linked yet.`}
                        actionLabel={getLabel('statusConfig')}
                        onAction={() => setEditMode(true)}
                        inline
                    />
                ) : (
                    <iframe
                        src={safeUrl}
                        className="status-iframe"
                        title={getLabel('status')}
                        /* allow-same-origin is deliberately absent: combined with
                           allow-scripts it would neutralise the sandbox entirely. */
                        sandbox="allow-scripts allow-popups allow-forms"
                        referrerPolicy="no-referrer"
                    />
                )}
            </div>
        </WidgetCard>
    );
};

export default StatusConsole;
