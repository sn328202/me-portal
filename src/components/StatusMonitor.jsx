import React, { useState, useEffect } from 'react';
import { GiSatelliteCommunication, GiGears } from 'react-icons/gi';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, EmptyState } from './ui';
import '../styles/StatusConsole.css';

/* The embed URL is typed by the user and goes straight into an iframe src,
   so anything that is not absolute http(s) is refused rather than framed. */
const safeHttpUrl = (raw) => {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
        const url = new URL(raw.trim());
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
};

const StatusMonitor = () => {
    const { user } = useAuth();
    const [embedUrl, setEmbedUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [inputVal, setInputVal] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            const key = `me_portal_retool_url_${user.id}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                setEmbedUrl(saved);
                setIsEditing(false);
            } else {
                setIsEditing(true);
            }
        }
    }, [user]);

    useEffect(() => {
        if (embedUrl) {
            setInputVal(embedUrl);
        }
    }, [embedUrl]);

    const handleSave = (e) => {
        e.preventDefault();
        if (!user) return;
        const url = safeHttpUrl(inputVal);
        if (!url) {
            setError('That is not a web address the monitor can reach. Use http:// or https://.');
            return;
        }
        setError('');
        localStorage.setItem(`me_portal_retool_url_${user.id}`, url);
        setEmbedUrl(url);
        setIsEditing(false);
    };

    const frameUrl = safeHttpUrl(embedUrl);

    return (
        <Card
            className="status-monitor"
            bodyClassName="status-monitor__body"
            title="Signal Feed"
            icon={<GiSatelliteCommunication />}
            actions={
                <Button size="sm" onClick={() => setIsEditing(!isEditing)}>
                    <GiGears /> {isEditing && frameUrl ? 'Cancel' : 'Configure Signal'}
                </Button>
            }
        >
            {/* Configuration Mode */}
            {isEditing && (
                <form onSubmit={handleSave} className="status-monitor__config stack">
                    <h3 className="section-title">Establish Connection</h3>
                    <p className="muted">
                        Enter the public URL or Embed URL of your Retool Dashboard (or any other embeddable status page).
                    </p>
                    <Field
                        label="Embed URL"
                        type="url"
                        value={inputVal}
                        onChange={(e) => setInputVal(e.target.value)}
                        placeholder="https://retool.com/embed/..."
                        error={error || undefined}
                        required
                    />
                    <div className="row">
                        <Button type="submit" variant="primary">Connect</Button>
                    </div>
                </form>
            )}

            {/* Live Feed */}
            {!isEditing && frameUrl && (
                <iframe
                    src={frameUrl}
                    title="Status Monitor"
                    className="status-iframe"
                    referrerPolicy="no-referrer"
                    /* `allow-same-origin` alongside `allow-scripts` lets the
                       framed page reach back into this origin and remove its
                       own sandbox attribute, which is the same as no sandbox
                       at all. Dropped. */
                    sandbox="allow-scripts allow-popups allow-forms"
                />
            )}

            {!isEditing && !frameUrl && (
                <EmptyState
                    icon={<GiSatelliteCommunication />}
                    message="No signal is bound to this monitor."
                    hint="Point it at a dashboard and it will keep watch."
                    actionLabel="Configure Signal"
                    onAction={() => setIsEditing(true)}
                />
            )}
        </Card>
    );
};

export default StatusMonitor;
