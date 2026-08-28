import React, { useRef, useState } from 'react';
import { GiTable, GiClothes } from 'react-icons/gi';
import { Button } from './ui';
import { supabase } from '../lib/supabase';
import { sheetPayload, readSheet, dayLabel } from '../utils/tripSheet';
import { sendToWardrobe } from '../utils/wardrobeHandoff';

/**
 * The trip, out to a spreadsheet and back again — and across to the Wardrobe.
 *
 * Three buttons doing the same kind of thing: take what the Atlas already knows
 * and put it where it is needed, instead of typing it a second time into a
 * sheet, a third time into the packing planner, and a fourth when the dates
 * change.
 *
 * It moves as a *file*, not through an API. The version that talked to Google
 * directly was blocked outright by her account — not the usual "unverified app,
 * continue anyway" screen but a flat refusal — and the way round that is a
 * Cloud Console project, which is more setup than the whole feature is worth.
 * A file needs nobody's permission: Drive opens an .xlsx as a normal Sheet, and
 * hands one back through File → Download.
 *
 * The import shows what it found before it writes anything. An importer that
 * silently rewrites a trip is one you check by hand afterwards, every time.
 */

const call = async (payload) => {
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'That did not work.');
    return result;
};

/** base64 -> a file the browser saves, without a round trip through a blob URL leak. */
const save = (base64, filename) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
};

const asBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(file);
});

const TripSheet = ({ trip, data, onUpdateTrip, onImport }) => {
    const [busy, setBusy] = useState(null);
    const [note, setNote] = useState(null);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);
    const picker = useRef(null);

    const say = (message) => { setError(null); setNote(message); };
    const fail = (message) => { setNote(null); setError(message); };

    const exportSheet = async () => {
        setBusy('export'); setNote(null); setError(null);
        try {
            const payload = sheetPayload(trip, data);
            const result = await call({ action: 'export', ...payload });
            save(result.file, result.filename);
            await onUpdateTrip?.(trip.id, { sheet_exported_at: new Date().toISOString() });
            say('Downloaded. Drop it in Google Drive and it opens as a Sheet — then paste its link above.');
        } catch (err) {
            fail(err.message);
        } finally {
            setBusy(null);
        }
    };

    const readIn = async (file) => {
        if (!file) return;
        setBusy('import'); setNote(null); setError(null);
        try {
            const result = await call({ action: 'import', file: await asBase64(file) });
            // The year lives in the trip, not in a header that says "Sat Dec 16".
            const year = Number(String(trip.start_date || '').slice(0, 4)) || undefined;

            // Her older sheets do not agree on what the itinerary tab is
            // called, so every tab is tried. The hour grid decides it: her
            // packing tab has a Date row and a Primary City row too, over more
            // days, and wins any contest settled on day count alone.
            const best = (result.tabs || [])
                .map((tab) => ({ tab: tab.name, ...readSheet(tab.rows, { year }) }))
                .sort((a, b) => (b.hours - a.hours)
                    || (b.items.length - a.items.length)
                    || (b.days.length - a.days.length))[0];

            if (!best || !best.days.length) {
                fail(best?.skipped?.[0] || 'Nothing in that file looked like an itinerary.');
                return;
            }
            setPreview(best);
        } catch (err) {
            fail(err.message);
        } finally {
            setBusy(null);
            if (picker.current) picker.current.value = '';
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
                    <GiTable /> {busy === 'export' ? 'Building…' : 'Download as a spreadsheet'}
                </Button>
                <Button size="sm" variant="ghost" onClick={toWardrobe}>
                    <GiClothes /> Send to the Wardrobe
                </Button>
            </div>

            {trip.sheet_exported_at && (
                <p className="tripsheet__when">Last downloaded {dayLabel(trip.sheet_exported_at)}.</p>
            )}

            <div className="tripsheet__import">
                <input
                    type="file"
                    ref={picker}
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="tripsheet__file"
                    id={`import-${trip.id}`}
                    onChange={(e) => readIn(e.target.files?.[0])}
                />
                <label htmlFor={`import-${trip.id}`} className="tripsheet__pick">
                    {busy === 'import' ? 'Reading…' : 'Read in an older sheet…'}
                </label>
                {/* The one instruction that decides whether this works at all. */}
                <span className="tripsheet__hint">
                    In Google Sheets: File → Download → Microsoft Excel (.xlsx)
                </span>
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
                                {/* "1 things" reads like a bug even when it is not. */}
                                <span>
                                    {preview.items.filter((i) => i.date === d.date).length === 1
                                        ? '1 thing'
                                        : `${preview.items.filter((i) => i.date === d.date).length} things`}
                                </span>
                            </li>
                        ))}
                        {preview.days.length > 6 && (
                            <li className="tripsheet__more">…and {preview.days.length - 6} more</li>
                        )}
                    </ul>

                    {preview.skipped?.length > 0 && (
                        <p className="tripsheet__skipped">Could not read: {preview.skipped.join(', ')}.</p>
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
