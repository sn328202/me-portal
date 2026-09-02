import React, { useEffect, useRef, useState } from 'react';
import { Button, Modal } from './ui';
import { searchMedia } from '../utils/mediaSearch';

/**
 * Choosing the thing that goes in a blank.
 *
 * Search first, because a wall of covers is the whole reason to look at this
 * page and typing a title gets you a list. But typing is always available
 * underneath: Steam has never heard of a board game, Open Library's spelling
 * of a translated title is its own, and a blank she cannot fill because a
 * database disagrees with her is worse than a blank with no picture.
 *
 * Debounced rather than submitted. Picking a favourite is browsing — you type
 * three letters, see what comes up, change your mind — and a search button
 * makes that four clicks instead of none.
 *
 * It is mounted only while it is open, which is why there is no effect here
 * resetting the query and the results: closing it destroys them, and opening
 * it again starts from nothing. An effect that clears state on a prop change
 * is a remount written the long way round.
 */

const SETTLE = 350;

const PickSearch = ({ media, prompt, onClose, onChoose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [note, setNote] = useState(null);
    const [busy, setBusy] = useState(false);
    const [byHand, setByHand] = useState(null);
    const box = useRef(null);
    // So a slow search that lands after a newer one cannot overwrite it.
    const run = useRef(0);

    // The field is the whole point of the dialog, so it should be ready.
    useEffect(() => {
        const id = setTimeout(() => box.current?.focus(), 60);
        return () => clearTimeout(id);
    }, []);

    const asked = query.trim();
    const long = asked.length >= 2;

    useEffect(() => {
        if (asked.length < 2) return undefined;

        // A slow search landing after a newer one must not overwrite it.
        const mine = run.current + 1;
        run.current = mine;
        const timer = setTimeout(async () => {
            setBusy(true);
            const { results: found, note: said } = await searchMedia(media, asked);
            if (run.current !== mine) return;
            setResults(found);
            setNote(said);
            setBusy(false);
        }, SETTLE);

        return () => clearTimeout(timer);
    }, [asked, media]);

    /* Derived rather than cleared: a query too short to search shows nothing,
       without an effect reaching in to empty the list it already holds. */
    const shown = long ? results : [];
    const said = long ? note : null;

    const choose = (item) => { onChoose(item); onClose(); };

    const chooseTyped = (e) => {
        e.preventDefault();
        const title = String(byHand?.title || '').trim();
        if (!title) return;
        choose({
            title,
            creator: String(byHand?.creator || '').trim() || null,
            image_url: String(byHand?.image_url || '').trim() || null,
            source: 'manual',
        });
    };

    return (
        <Modal open onClose={onClose} title={prompt?.title || 'Pick something'}>
            <div className="pick-search">
                {prompt?.hint && <p className="pick-search__hint">{prompt.hint}</p>}

                <input
                    ref={box}
                    className="input"
                    type="search"
                    value={query}
                    placeholder={`Search ${media === 'TV Show' ? 'shows' : `${media.toLowerCase()}s`}…`}
                    aria-label={`Search for a ${media}`}
                    onChange={(e) => setQuery(e.target.value)}
                />

                {busy && long && <p className="pick-search__said">Looking…</p>}
                {said && !busy && <p className="pick-search__said">{said}</p>}
                {!busy && !said && long && shown.length === 0 && (
                    <p className="pick-search__said">Nothing came back. Type it in below.</p>
                )}

                {shown.length > 0 && (
                    <ul className="pick-search__results">
                        {shown.map((r, i) => (
                            <li key={`${r.source}-${r.source_id || i}`}>
                                <button type="button" className="pick-result" onClick={() => choose(r)}>
                                    <span className="pick-result__art">
                                        {r.image_url
                                            ? <img src={r.image_url} alt="" loading="lazy"
                                                onError={(e) => {
                                                    // Steam's tall capsule does not exist for
                                                    // every game; the header still does.
                                                    if (r.fallback_image && e.currentTarget.src !== r.fallback_image) {
                                                        e.currentTarget.src = r.fallback_image;
                                                    } else {
                                                        e.currentTarget.style.visibility = 'hidden';
                                                    }
                                                }} />
                                            : <span className="pick-result__nocover">?</span>}
                                    </span>
                                    <span className="pick-result__words">
                                        <strong>{r.title}</strong>
                                        <span>
                                            {[r.creator, r.year].filter(Boolean).join(' · ') || ' '}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Always available, never in the way. */}
                {byHand ? (
                    <form className="pick-search__byhand" onSubmit={chooseTyped}>
                        <input
                            className="input" autoFocus placeholder="Title"
                            aria-label="Title" value={byHand.title || ''}
                            onChange={(e) => setByHand({ ...byHand, title: e.target.value })}
                        />
                        <input
                            className="input" placeholder="Who made it (optional)"
                            aria-label="Creator" value={byHand.creator || ''}
                            onChange={(e) => setByHand({ ...byHand, creator: e.target.value })}
                        />
                        <input
                            className="input" placeholder="Image URL (optional)"
                            aria-label="Image URL" value={byHand.image_url || ''}
                            onChange={(e) => setByHand({ ...byHand, image_url: e.target.value })}
                        />
                        <div className="pick-search__row">
                            <Button size="sm" type="submit">Use this</Button>
                            <Button size="sm" variant="ghost" type="button" onClick={() => setByHand(null)}>
                                Back to searching
                            </Button>
                        </div>
                    </form>
                ) : (
                    <button
                        type="button"
                        className="pick-search__type"
                        onClick={() => setByHand({ title: query.trim() })}
                    >
                        …or type it in yourself
                    </button>
                )}
            </div>
        </Modal>
    );
};

export default PickSearch;
