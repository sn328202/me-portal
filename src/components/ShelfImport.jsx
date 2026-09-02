import React, { useState } from 'react';
import { GiBookshelf } from 'react-icons/gi';
import { Button } from './ui';
import { readGoodreads, readLetterboxd } from '../utils/shelfImport';
import { readZip, sniff, textOf, bytesOf } from '../utils/shelfFiles';

/**
 * Your own export, used to remember what you loved.
 *
 * This began as an importer — 1,185 films into a table — and the thing wrong
 * with it was not the code. Goodreads and Letterboxd already hold the
 * catalogue and hold it better; copying it here answered a question she could
 * already ask somewhere else.
 *
 * What the export is still good for is *choosing*. "Top four films of all
 * time" is a hard question to answer cold and an easy one to answer while
 * looking at everything you have ever given five stars. So the file is read,
 * the best-rated are offered, and then the whole thing is thrown away. Nothing
 * is written except the one thing she points at.
 *
 * Read entirely in the browser, as before. It is her reading diary and her
 * viewing history, and the parsing does not need a server.
 */

/** Films come from Letterboxd, books from Goodreads. The rest have no export. */
const FROM = { Book: 'goodreads', Movie: 'letterboxd' };

const ShelfImport = ({ media, board = [], onPick }) => {
    const [candidates, setCandidates] = useState(null);
    const [reading, setReading] = useState(false);
    const [error, setError] = useState(null);
    const [target, setTarget] = useState(null);

    const wants = FROM[media];

    // Albums and games have no export to read, and a control that cannot do
    // anything is worse than no control.
    if (!wants) return null;

    const read = async (file) => {
        if (!file) return;
        setReading(true); setError(null); setCandidates(null);
        try {
            let items = [];
            if (/\.zip$/i.test(file.name)) {
                const { files } = readZip(await bytesOf(file));
                if (!Object.keys(files).length) throw new Error('That ZIP has no Letterboxd CSVs in it.');
                ({ items } = readLetterboxd(files));
            } else {
                const text = await textOf(file);
                const kind = sniff(file.name, text);
                if (kind === 'goodreads') ({ items } = readGoodreads(text));
                else if (kind === 'letterboxd-csv') ({ items } = readLetterboxd({ watched: text }));
                else {
                    throw new Error(
                        'That does not look like a Goodreads or Letterboxd export. '
                        + 'Goodreads: My Books → Import and Export → Export Library. '
                        + 'Letterboxd: Settings → Data → Export your data.'
                    );
                }
            }

            /* The best of it, which is the only part worth looking at when the
               question is "what are your four favourites". Highest rated
               first, and among equals the most recent — a five star from last
               month is fresher in mind than one from 2019. */
            const best = items
                .filter((i) => (i.rating ?? 0) >= 4)
                .sort((a, b) => (b.rating - a.rating)
                    || String(b.finished_at || '').localeCompare(String(a.finished_at || '')))
                .slice(0, 60);

            if (!best.length) {
                throw new Error(`Read ${items.length}, but none rated four or above — nothing to shortlist.`);
            }
            setCandidates({ best, total: items.length });
        } catch (err) {
            setError(err.message || 'That file could not be read.');
        } finally {
            setReading(false);
        }
    };

    const openSlots = board.flatMap((row) => row.slots.map((s, position) => (
        s ? null : { slot: row.id, position, label: row.slots.length > 1 ? `${row.title} #${position + 1}` : row.title }
    )).filter(Boolean));

    const put = (item) => {
        const where = target || openSlots[0];
        if (!where) return;
        onPick(item, where.slot, where.position);
    };

    return (
        <div className="shelf-import">
            <div className="shelf-import__row">
                <input
                    type="file" id="shelf-file" className="shelf-import__file"
                    accept=".csv,.zip,text/csv,application/zip"
                    onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }}
                />
                <label htmlFor="shelf-file" className="shelf-import__pick">
                    {reading ? 'Reading…' : `Shortlist from my ${wants === 'goodreads' ? 'Goodreads' : 'Letterboxd'} export`}
                </label>
                {candidates && (
                    <Button size="sm" variant="ghost" onClick={() => setCandidates(null)}>Done</Button>
                )}
            </div>

            {!candidates && !error && (
                <p className="shelf-import__how">
                    <GiBookshelf aria-hidden="true" />{' '}
                    Hard to answer cold, easy while looking at everything you gave five stars to.
                    Drop your export and it shows the best of it to choose from — then forgets it.
                    Nothing is saved but what you point at.
                </p>
            )}

            {candidates && (
                <div className="shelf-import__found">
                    <p className="shelf-import__line">
                        <strong>{candidates.best.length}</strong> of {candidates.total} rated four or more.
                        {openSlots.length === 0 && ' Every blank is full — clear one first.'}
                    </p>

                    {openSlots.length > 0 && (
                        <label className="shelf-import__where">
                            Put it in:
                            <select
                                className="select"
                                value={target ? `${target.slot}|${target.position}` : ''}
                                onChange={(e) => {
                                    const [slot, position] = e.target.value.split('|');
                                    setTarget(slot ? { slot, position: Number(position) } : null);
                                }}
                            >
                                <option value="">the next empty blank</option>
                                {openSlots.map((s) => (
                                    <option key={`${s.slot}|${s.position}`} value={`${s.slot}|${s.position}`}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    <ul className="shelf-import__shortlist">
                        {candidates.best.map((i) => (
                            <li key={`${i.source}-${i.source_id}`}>
                                <button
                                    type="button"
                                    className="shortlist__item"
                                    disabled={openSlots.length === 0}
                                    onClick={() => put(i)}
                                >
                                    <strong>{i.title}</strong>
                                    <span>
                                        {[i.creator, i.year].filter(Boolean).join(' · ')}
                                        {i.rating != null && ` · ${i.rating}★`}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {error && <p className="shelf-import__bad" role="status">{error}</p>}
        </div>
    );
};

export default ShelfImport;
