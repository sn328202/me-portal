import React, { useMemo } from 'react';
import { usePicks } from '../hooks/usePicks';
import { MEDIA, tally, thisYear } from '../utils/picks';
import { useTheme } from '../contexts/ThemeContext';
import { GiBookshelf, GiFilmStrip, GiCompactDisc, GiTv, GiGamepad } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import WidgetLoading from '../components/WidgetLoading';
import EmptyState from '../components/EmptyState';
import Stat from '../components/ui/Stat';
import '../styles/LibraryStats.css';

/*
 * The Library stopped being a count of everything finished, so this stopped
 * counting it. "247 books" was a fact about Goodreads wearing this portal's
 * clothes; how many of the blanks she has answered is a fact about this page.
 */
const KINDS = [
    { key: 'Books', type: 'Book', icon: <GiBookshelf size={24} /> },
    { key: 'Movies', type: 'Movie', icon: <GiFilmStrip size={24} /> },
    { key: 'Albums', type: 'Album', icon: <GiCompactDisc size={24} /> },
    { key: 'Shows', type: 'TV Show', icon: <GiTv size={24} /> },
    { key: 'Games', type: 'Game', icon: <GiGamepad size={24} /> },
];

const LibraryStats = () => {
    const { picks, loading } = usePicks();
    const { getLabel } = useTheme();
    const year = thisYear();

    const stats = useMemo(() => KINDS.reduce((acc, kind) => {
        acc[kind.key] = tally(picks, kind.type, year).filled;
        return acc;
    }, {}), [picks, year]);

    /* What she is in the middle of, across all five — which is the half of
       this widget anyone actually reads. */
    const nowConsuming = useMemo(
        () => picks.filter((p) => p.slot === 'currently')
            .sort((a, b) => MEDIA.indexOf(a.media) - MEDIA.indexOf(b.media)),
        [picks]
    );

    return (
        <WidgetCard title={getLabel('library')} icon={<GiBookshelf />} span={3}>
            {loading ? (
                <WidgetLoading />
            ) : (
                <>
                    <div className="stat-row library-kpi-grid">
                        {KINDS.map(kind => (
                            <Stat key={kind.key} icon={kind.icon} value={stats[kind.key]} label={kind.key} />
                        ))}
                    </div>

                    <div className="library-now-consuming-container">
                        <h4 className="library-subtitle">
                            {getLabel('nowConsuming')}
                        </h4>

                        {nowConsuming.length === 0 ? (
                            <EmptyState
                                message={`Nothing ${getLabel('nowConsuming').toLowerCase()}.`}
                                icon={<GiBookshelf />}
                                inline
                            />
                        ) : (
                            <div className="library-consuming-list">
                                {nowConsuming.map(item => (
                                    <div key={item.id} className="library-item-card">
                                        <div className="library-item-poster">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt="" className="library-item-image" />
                                            ) : (
                                                <div className="library-item-placeholder" aria-hidden="true">?</div>
                                            )}
                                        </div>
                                        <div className="library-item-title">{item.title}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </WidgetCard>
    );
};

export default LibraryStats;
