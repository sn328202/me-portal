import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePicks } from '../hooks/usePicks';
import { MEDIA } from '../utils/picks';
import { useTheme } from '../contexts/ThemeContext';
import { GiBookshelf } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import WidgetLoading from '../components/WidgetLoading';
import '../styles/LibraryStats.css';

/*
 * The Library is a page of favourites, so this shows the favourites.
 *
 * It used to show five numbers — how many blanks she had filled per medium —
 * over a "currently consuming" row that said "Nothing currently", because
 * `currently` is the one slot she has never used. So a shelf holding eighteen
 * chosen things with cover art for every one of them was rendering as five
 * digits and an empty state.
 *
 * Covers, then. It is the only widget on the page whose content is pictures,
 * and a strip of them says what the room is for in a way "4 · MOVIES" never
 * did. What she is in the middle of leads when there is any, because that is
 * the part that changes.
 */

/* Mixed media, mixed shapes: a book is tall, an album is square, a Steam
   capsule is taller still. One height and a free width keeps them a shelf
   rather than a grid of crops. */
const Cover = ({ pick }) => (
    <li className="stack__item" title={[pick.title, pick.creator].filter(Boolean).join(' · ')}>
        {pick.image_url ? (
            <img
                className="stack__art"
                src={pick.image_url}
                alt={pick.title}
                loading="lazy"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            />
        ) : (
            <span className="stack__nocover">{pick.title.slice(0, 1)}</span>
        )}
    </li>
);

const LibraryStats = () => {
    const { picks, loading } = usePicks();
    const { getLabel } = useTheme();

    const { shown, count, shelves, current } = useMemo(() => {
        const all = picks || [];
        const currently = all.filter((p) => p.slot === 'currently');
        const favourites = all.filter((p) => p.slot !== 'currently');

        /* In the order the Library reads — books, films, shows, albums, games
           — rather than by when she happened to add them, so the strip looks
           the same tomorrow as it does today. */
        const byMedia = (a, b) => MEDIA.indexOf(a.media) - MEDIA.indexOf(b.media)
            || (a.position ?? 0) - (b.position ?? 0);

        return {
            shown: [...currently.sort(byMedia), ...favourites.sort(byMedia)].slice(0, 14),
            count: all.length,
            shelves: new Set(all.map((p) => p.media)).size,
            current: currently.length,
        };
    }, [picks]);

    return (
        <WidgetCard
            title={getLabel('library')}
            icon={<GiBookshelf />}
            span={3}
            actions={<Link className="stack__all" to="/library">All of it →</Link>}
        >
            {loading ? (
                <WidgetLoading />
            ) : count === 0 ? (
                <p className="stack__empty">
                    Nothing chosen yet. The Library is four favourites per shelf and a
                    handful of blanks worth arguing about.
                </p>
            ) : (
                <>
                    <ul className="stack__strip">
                        {shown.map((p) => <Cover key={p.id} pick={p} />)}
                    </ul>
                    <p className="stack__line">
                        <strong>{count}</strong> {count === 1 ? 'pick' : 'picks'} across {shelves}
                        {shelves === 1 ? ' shelf' : ' shelves'}
                        {current > 0
                            ? ` · ${current} on the go`
                            : ' · nothing marked as on the go'}
                    </p>
                </>
            )}
        </WidgetCard>
    );
};

export default LibraryStats;
