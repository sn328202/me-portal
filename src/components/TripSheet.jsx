import React, { useState } from 'react';
import { GiTable, GiClothes } from 'react-icons/gi';
import { Button } from './ui';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';
import { sheetPayload, readSheet, dayLabel } from '../utils/tripSheet';
import { sendToWardrobe } from '../utils/wardrobeHandoff';

/**
 * The trip, out to a spreadsheet and back again — and across to the Wardrobe.
 *
 * Three buttons that all do the same kind of thing: take what the Atlas knows
 * and put it where it is already needed, instead of asking her to type it a
 * second time into a sheet, a third time into the packing planner, and a
 * fourth time when the dates change.
 *
 * The import shows what it found before it writes anything. An importer that
 * silently rewrites a trip is one you check by hand afterwards, every time,
 * which costs more than it saved.
 */

const call = async (action, payload, settings) => {
    const endpoint = settings.sheetsEndpoint;
    if (!endpoint) {
        throw new Error('Add your Apps Script URL in Settings → Google Sheets first.');
    }
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({ endpoint, secret: settings.sheetsSecret || '', action, ...payload }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'That did not work.');
    return result;
};

const TripSheet = ({ trip, data, onUpdateTrip, onImport }) => {
    const { settings } = useSettings();
    const [busy, setBusy] = useState(null);
    const [note, setNote] = useState(null);
    const [error, setError] = useState(null);
    const [url, setUrl] = useState('');
    const [preview, setPreview] = useState(null);

    const say = (message) => { setError(null); setNote(message); };
    const fail = (message) => { setNote(null); setError(message); };

    const exportSheet = async () => {
        setBusy('export'); setNote(null); setError(null);
        try {
            const result = await call('export', sheetPayload(trip, data), settings);
            await onUpdateTrip?.(trip.id, {
                google_sheets_url: result.url,
                sheet_exported_at: new Date().toISOString(),
            });
            say(`Written to ${result.tabs.join(', ')}.`);
        } catch (err) {
            fail(err.message);
        } finally {
            setBusy(null);
        }
    };

    const readIn = async () => {
        const from = url.trim() || trip.google_sheets_url;
        if (!from) { fail('Paste the link to the sheet you want to read.'); return; }

        setBusy('import'); setNote(null); setError(null);
        try {
            const result = await call('import', { url: from }, settings);
            // The year lives in the trip, not in a header that says "Sat Dec 16".
            const year = Number(String(trip.start_date || '').slice(0, 4)) || undefined;

            // Try each tab and keep whichever yields the most days: her older
            // sheets do not agree on what the itinerary tab is called.
            const best = (result.tabs || [])
                .map((tab) => ({ tab: tab.name, ...readSheet(tab.rows, { year }) }))
                .sort((a, b) => b.days.length - a.days.length)[0];

            if (!best || !best.days.length) {
                fail(best?.skipped?.[0] || 'Nothing in that sheet looked like an itinerary.');
                return;
            }
            setPreview(best);
        } catch (err) {
            fail(err.message);
        } finally {
            setBusy(null);
        }
    };

    const confirmImport = async () => {
        setBusy('apply');
        try {
            const result = await onImport?.(preview);
            if (result?.ok) {
                say(`Brought in ${result.days} days and ${result.items} things.`);
                setPreview(null);
            } else {
                fail(result?.reason || 'That did not write.');
            }
        } finally {
            setBusy(null);
        }
    };

    const toWardrobe = () => {
        const result = sendToWardrobe(trip, data);
        if (!result.ok) { fail(result.reason); return; }
        say(
            `${result.updated ? 'Updated' : 'Created'} this trip in the Wardrobe — `
            + `${result.events} days planned, weather on ${result.days}.`
        );
    };

    return (
        <div className="tripsheet">
            <div className="panel__row">
                {trip.google_sheets_url && (
                    <a href={trip.google_sheets_url} target="_blank" rel="noopener noreferrer" className="atlas-link">
                        Open Ledger
                    </a>
                )}
                <Button size="sm" variant="ghost" onClick={exportSheet} disabled={busy === 'export'}>
                    <GiTable /> {busy === 'export' ? 'Writing…' : 'Export to Google Sheets'}
                </Button>
                <Button size="sm" variant="ghost" onClick={toWardrobe}>
                    <GiClothes /> Send to the Wardrobe
                </Button>
            </div>

            {trip.sheet_exported_at && (
                <p className="tripsheet__when">
                    Last written {dayLabel(trip.sheet_exported_at)}.
                </p>
            )}

            <div className="tripsheet__import">
                <input
                    type="text"
                    value={url}
                    aria-label="A sheet to read in"
                    placeholder="Paste an older sheet to read into this trip…"
                    onChange={(e) => setUrl(e.target.value)}
                />
                <Button size="sm" variant="ghost" onClick={readIn} disabled={busy === 'import'}>
                    {busy === 'import' ? 'Reading…' : 'Read it in'}
                </Button>
            </div>

            {/* Shown before anything is written, because the alternative is
                checking a fifteen-day trip by hand afterwards. */}
            {preview && (
                <div className="tripsheet__preview">
                    <h5>
                        Found {preview.days.length} {preview.days.length === 1 ? 'day' : 'days'}
                        {' '}and {preview.items.length} planned {preview.items.length === 1 ? 'thing' : 'things'}
                        {preview.tab ? ` on “${preview.tab}”` : ''}
                    </h5>
                    <ul>
                        {preview.days.slice(0, 6).map((d) => (
                            <li key={d.date}>
                                <strong>{dayLabel(d.date)}</strong>
                                <span>{d.city || '—'}</span>
                                <span>{preview.items.filter((i) => i.date === d.date).length} things</span>
                            </li>
                        ))}
                        {preview.days.length > 6 && <li className="tripsheet__more">…and {preview.days.length - 6} more</li>}
                    </ul>

                    {preview.skipped?.length > 0 && (
                        <p className="tripsheet__skipped">
                            Could not read: {preview.skipped.join(', ')}.
                        </p>
                    )}

                    <p className="tripsheet__warn">
                        This replaces whatever is currently planned on those days.
                    </p>
                    <div className="panel__row">
                        <Button size="sm" variant="solid" onClick={confirmImport} disabled={busy === 'apply'}>
                            {busy === 'apply' ? 'Writing…' : 'Bring it in'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
                    </div>
                </div>
            )}

            {note && <p className="tripsheet__note" role="status">{note}</p>}
            {error && <p className="panel__error" role="status">{error}</p>}
        </div>
    );
};

export default TripSheet;
