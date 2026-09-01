import React, { useState } from 'react';
import { GiTrashCan, GiCheckMark, GiSundial } from 'react-icons/gi';
import { Button, Field, Tag } from './ui';
import { useCalendar } from '../hooks/useCalendar';
import { useSettings } from '../hooks/useSettings';

/**
 * Manage the calendars the Chronometer reads.
 *
 * The embed can only show what a calendar is *shared* as. A calendar shared
 * "free/busy only" hands out events titled literally "Busy" — which is why the
 * widget looked empty. The secret address returns full detail without making
 * anything public, so that is what this collects.
 *
 * Every address is checked before it can be saved: a typo, an expired secret,
 * or the web link pasted instead of the iCal one all fail in ways that are
 * indistinguishable from "no events" once saved.
 */

const hostOf = (url) => {
    try {
        return new URL(url.replace(/^webcal:/, 'https:')).hostname.replace(/^www\./, '');
    } catch {
        return url.slice(0, 40);
    }
};

const CalendarFeeds = () => {
    const { savedFeeds, feeds, probe, addFeed, removeFeed } = useCalendar();
    const { settings, updateSetting } = useSettings();
    const mine = settings.portalCalendar || {};
    const showing = (key) => mine[key] !== false;
    const toggle = (key) => updateSetting('portalCalendar', { ...mine, [key]: !showing(key) });
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [checking, setChecking] = useState(false);
    const [checked, setChecked] = useState(null);

    const status = (id) => feeds.find((f) => f.id === id);

    const check = async () => {
        if (!url.trim() || checking) return;
        setChecking(true);
        setChecked(null);
        setChecked(await probe(url.trim()));
        setChecking(false);
    };

    const save = async () => {
        if (!checked?.ok) return;
        await addFeed({ name: name.trim() || checked.calendarName, url: url.trim() });
        setName('');
        setUrl('');
        setChecked(null);
    };

    return (
        <div className="stack">
            <p className="integration-note">
                Add each calendar by its <strong>secret address in iCal format</strong>. In Google
                Calendar, open a calendar&rsquo;s <em>Settings and sharing</em>, scroll to
                <em> Integrate calendar</em>, and copy the secret address — not the public one.
                Nothing has to be made public, and it works on your phone.
            </p>

            {/* The portal's own days, which need no address because they are
                already here. This is what "export the itinerary to my
                calendar" should have meant: not a file that goes stale and
                not a write scope, just the agenda reading what the portal
                already knows. */}
            <ul className="feed-list">
                {[
                    ['trips', 'Your trips', 'Each expedition and day out across its dates, and its timed stops'],
                ].map(([key, name, what]) => {
                    const live = status(`portal-${key}`);
                    return (
                        <li key={key} className="feed-row feed-row--mine">
                            <span
                                className="feed-dot"
                                style={{ background: key === 'trips' ? 'var(--accent-crimson)' : 'var(--accent-gold)' }}
                                aria-hidden="true"
                            />
                            <div className="feed-meta">
                                <strong>{name}</strong>
                                <span className="muted"> — {what}</span>
                            </div>
                            {live?.ok && showing(key) && <Tag tone="green">{live.count} events</Tag>}
                            <Button
                                size="sm"
                                aria-pressed={showing(key)}
                                label={showing(key) ? `Hide ${name}` : `Show ${name}`}
                                onClick={() => toggle(key)}
                            >
                                {showing(key) ? 'Showing' : 'Hidden'}
                            </Button>
                        </li>
                    );
                })}
            </ul>

            {savedFeeds.length > 0 && (
                <ul className="feed-list">
                    {savedFeeds.map((feed) => {
                        const live = status(feed.id);
                        return (
                            <li key={feed.id} className="feed-row">
                                <span className="feed-dot" style={{ background: feed.color }} aria-hidden="true" />
                                <div className="feed-meta">
                                    <strong>{feed.name}</strong>
                                    {/* The address itself is deliberately never rendered —
                                        it is a credential, and this page gets screenshared. */}
                                    <span className="muted"> — {hostOf(feed.url)}</span>
                                </div>
                                {live && (
                                    <Tag tone={live.ok ? 'green' : 'default'}>
                                        {live.ok ? `${live.count} events` : live.error}
                                    </Tag>
                                )}
                                <Button
                                    icon
                                    size="sm"
                                    label={`Remove ${feed.name}`}
                                    onClick={() => removeFeed(feed.id)}
                                >
                                    <GiTrashCan />
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="feed-add">
                <Field
                    label="Name"
                    type="text"
                    placeholder="Personal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <Field
                    label="Secret address in iCal format"
                    type="url"
                    placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setChecked(null); }}
                />
                <Button onClick={check} disabled={!url.trim() || checking}>
                    {checking ? 'Checking…' : 'Check'}
                </Button>
            </div>

            {checked && !checked.ok && (
                <p className="integration-warning">Could not read that calendar — {checked.error}</p>
            )}

            {checked?.ok && (
                <div className="feed-check">
                    <p className="integration-msg">
                        <GiCheckMark aria-hidden="true" />{' '}
                        <strong>{checked.calendarName || 'Calendar'}</strong> — {checked.eventCount} events
                        in the next three months.
                        {checked.sample?.length > 0 && (
                            <> First up: {checked.sample.map((s) => s.title).join(', ')}.</>
                        )}
                    </p>

                    {checked.freeBusyOnly && (
                        <p className="integration-warning">
                            Every event on this calendar is titled &ldquo;Busy&rdquo; — that is the
                            public free/busy feed, not the secret one. Go back to <em>Integrate
                            calendar</em> and copy the address under <em>Secret address in iCal
                            format</em> instead.
                        </p>
                    )}

                    <Button variant="primary" onClick={save} disabled={checked.freeBusyOnly}>
                        <GiSundial /> Add this calendar
                    </Button>
                </div>
            )}
        </div>
    );
};

export default CalendarFeeds;
