import React, { useMemo } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { useTheme } from '../contexts/ThemeContext';
import { GiBookshelf, GiFilmStrip, GiCompactDisc, GiTv, GiGamepad } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import WidgetLoading from '../components/WidgetLoading';
import EmptyState from '../components/EmptyState';
import Stat from '../components/ui/Stat';
import '../styles/LibraryStats.css';

const KINDS = [
    { key: 'Books', type: 'Book', icon: <GiBookshelf size={24} /> },
    { key: 'Movies', type: 'Movie', icon: <GiFilmStrip size={24} /> },
    { key: 'Albums', type: 'Album', icon: <GiCompactDisc size={24} /> },
    { key: 'Shows', type: 'TV Show', icon: <GiTv size={24} /> },
    { key: 'Games', type: 'Game', icon: <GiGamepad size={24} /> },
];

const LibraryStats = () => {
    const { items, loading } = useLibrary();
    const { getLabel } = useTheme();

    const stats = useMemo(() => {
        const completed = items.filter(i => i.status === 'Completed');
        return KINDS.reduce((acc, kind) => {
            acc[kind.key] = completed.filter(i => i.type === kind.type).length;
            return acc;
        }, {});
    }, [items]);

    const nowConsuming = useMemo(() => {
        return items.filter(i => i.status === 'In Progress');
    }, [items]);

    return (
        <WidgetCard title={`${getLabel('library')} Consumed`} icon={<GiBookshelf />} span={3}>
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
