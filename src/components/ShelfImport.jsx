import React, { useRef } from 'react';
import { GiBookshelf, GiFilmProjector } from 'react-icons/gi';
import { Button } from './ui';
import { useShelfImport } from '../hooks/useShelfImport';

/**
 * Bringing a Goodreads or Letterboxd shelf into the Library.
 *
 * Neither service can be asked for this. Goodreads stopped issuing API keys in
 * 2020; Letterboxd's API is invitation-only and says outright that personal
 * projects are not granted access. What both still do is hand you your own
 * data as a file, so a file is the way in — the same shape as the trip
 * spreadsheet, for the same reason: a file needs nobody's permission and does
 * not stop working when a policy changes.
 *
 * It shows what it found before it writes anything. An importer that reads a
 * file and applies it in one gesture is one she has to check by hand
 * afterwards, every time.
 */
const ShelfImport = ({ items = [], onDone }) => {
    const picker = useRef(null);
    const {
        read, write, fillPosters, forget, found, reading, writing, error, note,
    } = useShelfImport(items, onDone);

    const filmsWithoutPosters = items.filter((i) => i.type === 'Movie' && !i.image_url).length;
    const busy = reading || writing;

    return (
        <div className="shelf-import">
            <div className="shelf-import__row">
                <input
                    type="file"
                    ref={picker}
                    accept=".csv,.zip,text/csv,application/zip"
                    id="shelf-file"
                    className="shelf-import__file"
                    onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }}
                />
                <label htmlFor="shelf-file" className="shelf-import__pick">
                    {reading ? 'Reading…' : 'Bring in a shelf…'}
                </label>

                {filmsWithoutPosters > 0 && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => fillPosters(items)}>
                        <GiFilmProjector /> Find {filmsWithoutPosters} poster{filmsWithoutPosters === 1 ? '' : 's'}
                    </Button>
                )}
            </div>

            {!found && !error && !note && (
                <p className="shelf-import__how">
                    <GiBookshelf aria-hidden="true" />{' '}
                    Goodreads: <em>My Books → Import and Export → Export Library</em>.
                    {' '}Letterboxd: <em>Settings → Data → Export your data</em> — drop the whole ZIP.
                    {' '}Only things you have finished come across, and the file is read here in the
                    browser rather than sent anywhere.
                </p>
            )}

            {/* What it found. Nothing has been written at this point. */}
            {found && (
                <div className="shelf-import__found">
                    <p className="shelf-import__line">
                        <strong>{found.from === 'goodreads' ? 'Goodreads' : 'Letterboxd'}</strong>
                        {' — '}{found.line}.
                        {found.saw?.length > 0 && (
                            <span className="shelf-import__saw"> Read: {found.saw.join(', ')}.</span>
                        )}
                    </p>

                    {found.skipped?.unread > 0 && (
                        <p className="shelf-import__aside">
                            {found.skipped.unread} left on the to-read shelf, where they belong.
                        </p>
                    )}
                    {found.skipped?.untitled > 0 && (
                        <p className="shelf-import__aside">
                            {found.skipped.untitled} had no title to file them under.
                        </p>
                    )}

                    {/* The first few, so she can see it read the right file
                        before she agrees to six hundred rows of it. */}
                    {found.fresh.length > 0 && (
                        <ul className="shelf-import__peek">
                            {found.fresh.slice(0, 5).map((i) => (
                                <li key={`${i.source}-${i.source_id}`}>
                                    <strong>{i.title}</strong>
                                    {i.creator && <span> · {i.creator}</span>}
                                    {i.year && <span> · {i.year}</span>}
                                    {i.rating != null && <span> · {i.rating}★</span>}
                                    {i.finished_at && <span> · {i.finished_at}</span>}
                                </li>
                            ))}
                            {found.fresh.length > 5 && (
                                <li className="shelf-import__more">
                                    …and {found.fresh.length - 5} more.
                                </li>
                            )}
                        </ul>
                    )}

                    <div className="shelf-import__row">
                        <Button size="sm" disabled={writing} onClick={write}>
                            {writing ? 'Filing…' : `Put ${found.fresh.length + found.update.length} on the shelf`}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={writing} onClick={forget}>
                            Not now
                        </Button>
                    </div>
                </div>
            )}

            {note && <p className="shelf-import__note" role="status">{note}</p>}
            {error && <p className="shelf-import__bad" role="status">{error}</p>}
        </div>
    );
};

export default ShelfImport;
