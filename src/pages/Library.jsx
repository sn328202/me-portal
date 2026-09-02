import React, { useMemo, useState } from 'react';
import {
    GiBookshelf, GiBookCover, GiFilmStrip, GiCompactDisc, GiTv, GiGamepad, GiTrashCan,
} from 'react-icons/gi';
import { Card, PageHeader, Tabs, Tag } from '../components/ui';
import PickSearch from '../components/PickSearch';
import ShelfImport from '../components/ShelfImport';
import { usePicks } from '../hooks/usePicks';
import { MEDIA, boardFor, tally, thisYear, ELSEWHERE } from '../utils/picks';
import '../styles/Library.css';

/**
 * The Library, which is not a catalogue.
 *
 * It was one: everything consumed, kept on the shelf, with an importer that
 * would have put 1,185 films into it. Then she looked at the result and said
 * the true thing about it — Goodreads and Letterboxd already hold that, and
 * hold it better, so a second copy answers a question she can already ask
 * somewhere else.
 *
 * This answers the other question. Four favourites, what she is in the middle
 * of, and a handful of blanks worth arguing about: a page you could show
 * someone to explain your taste, rather than a list of everything you have
 * ever finished — and short enough that changing your mind is a small act
 * rather than a migration.
 *
 * The blanks are deliberately visible when empty. An unanswered question is
 * the invitation; a page that showed only the answers would have nowhere to
 * put the next one.
 */

const ICON = {
    Book: <GiBookCover />,
    Movie: <GiFilmStrip />,
    'TV Show': <GiTv />,
    Album: <GiCompactDisc />,
    Game: <GiGamepad />,
};

/** A filled slot: the cover, and who made the thing. */
const Filled = ({ pick, big, onClear }) => (
    <div className={`pick${big ? ' pick--big' : ''}`}>
        <div className="pick__art">
            {pick.image_url ? (
                <img
                    src={pick.image_url}
                    alt=""
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
            ) : (
                <span className="pick__nocover">{pick.title.slice(0, 1)}</span>
            )}
            <button
                type="button"
                className="pick__clear"
                aria-label={`Remove ${pick.title}`}
                onClick={() => onClear(pick)}
            >
                <GiTrashCan />
            </button>
        </div>
        <span className="pick__title">
            {pick.link
                ? <a href={pick.link} target="_blank" rel="noopener noreferrer">{pick.title}</a>
                : pick.title}
        </span>
        {pick.creator && <span className="pick__creator">{pick.creator}</span>}
    </div>
);

/** An empty slot, which is a question rather than a hole. */
const Blank = ({ big, label, onClick }) => (
    <button type="button" className={`pick pick--blank${big ? ' pick--big' : ''}`} onClick={onClick}>
        <span className="pick__art pick__art--blank" aria-hidden="true">+</span>
        <span className="pick__title">{label}</span>
    </button>
);

const Library = () => {
    const { picks, loading, error, setPick, clearPick } = usePicks();
    const [media, setMedia] = useState('Book');
    const [asking, setAsking] = useState(null);
    const year = thisYear();

    const board = useMemo(() => boardFor(picks, media, year), [picks, media, year]);
    const done = useMemo(() => tally(picks, media, year), [picks, media, year]);

    const tabs = useMemo(() => MEDIA.map((m) => ({
        id: m,
        label: m === 'TV Show' ? 'TV' : `${m}s`,
        icon: ICON[m],
        count: tally(picks, m, year).filled,
    })), [picks, year]);

    const elsewhere = ELSEWHERE[media];

    return (
        <div className="page">
            <PageHeader
                title="The Library"
                icon={<GiBookshelf />}
                subtitle="Not everything — only the ones worth arguing about."
                actions={elsewhere && (
                    <a className="atlas-link" href={elsewhere.href} target="_blank" rel="noopener noreferrer">
                        Everything on {elsewhere.label} ↗
                    </a>
                )}
            />

            <Tabs tabs={tabs} active={media} onChange={setMedia} label="Media types" />

            {error && <p className="muted">{error}</p>}

            <p className="picks__progress">
                <strong>{done.filled}</strong> of {done.of} blanks filled in
                {done.filled === 0 && ' — start anywhere.'}
            </p>

            {loading ? (
                <p className="muted">Opening the shelf…</p>
            ) : (
                board.map((row) => (
                    <section key={row.id} className="picks__row">
                        <header className="picks__head">
                            <h3>
                                {row.title}
                                {row.filled === 0 && <Tag tone="default">blank</Tag>}
                            </h3>
                            <p>{row.hint}</p>
                        </header>

                        <div className={`picks__slots${row.id === 'top_four' ? ' picks__slots--four' : ''}`}>
                            {row.slots.map((pick, position) => (
                                pick ? (
                                    <Filled
                                        key={pick.id || `slot-${position}`}
                                        pick={pick}
                                        big={row.id === 'top_four'}
                                        onClear={clearPick}
                                    />
                                ) : (
                                    <Blank
                                        key={`blank-${position}`}
                                        big={row.id === 'top_four'}
                                        label={row.slots.length > 1 ? `#${position + 1}` : 'Pick one'}
                                        onClick={() => setAsking({ row, position })}
                                    />
                                )
                            ))}
                        </div>
                    </section>
                ))
            )}

            {/* The export is a way to choose, not a thing to store: it offers
                her highest-rated as candidates and keeps none of the rest. */}
            <Card variant="flat">
                <ShelfImport
                    media={media}
                    onPick={(item, slot, position) => setPick(media, slot, position, item, year)}
                    board={board}
                />
            </Card>

            {/* Mounted only while it is open, so closing it is what clears
                it — no effect reaching in to reset a query and a result list. */}
            {asking && (
                <PickSearch
                    media={media}
                    prompt={asking.row}
                    onClose={() => setAsking(null)}
                    onChoose={(item) => setPick(media, asking.row.id, asking.position, item, year)}
                />
            )}
        </div>
    );
};

export default Library;
