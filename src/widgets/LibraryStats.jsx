import React, { useMemo } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { useTheme } from '../contexts/ThemeContext';
import { GiBookshelf, GiFilmStrip, GiCompactDisc, GiTv, GiGamepad } from 'react-icons/gi';
import '../styles/LibraryStats.css';

const LibraryStats = () => {
    const { items, loading } = useLibrary();
    const { getLabel } = useTheme();

    const stats = useMemo(() => {
        const completed = items.filter(i => i.status === 'Completed');
        return {
            Books: completed.filter(i => i.type === 'Book').length,
            Movies: completed.filter(i => i.type === 'Movie').length,
            Albums: completed.filter(i => i.type === 'Album').length,
            Shows: completed.filter(i => i.type === 'TV Show').length,
            Games: completed.filter(i => i.type === 'Game').length,
        };
    }, [items]);

    const nowConsuming = useMemo(() => {
        return items.filter(i => i.status === 'In Progress');
    }, [items]);

    if (loading) return <div className="library-loading">Loading Archive...</div>;

    return (
        <div className="library-stats-container">

            {/* KPI STATS */}
            <div>
                <h3 className="library-section-title">
                    {getLabel('library')} Consumed
                </h3>
                <div className="library-kpi-grid">
                    <div className="library-stat-box">
                        <GiBookshelf size={24} color="var(--border-gold)" />
                        <div className="library-stat-value">{stats.Books}</div>
                        <div className="library-stat-label">Books</div>
                    </div>
                    <div className="library-stat-box">
                        <GiFilmStrip size={24} color="var(--border-gold)" />
                        <div className="library-stat-value">{stats.Movies}</div>
                        <div className="library-stat-label">Movies</div>
                    </div>
                    <div className="library-stat-box">
                        <GiCompactDisc size={24} color="var(--border-gold)" />
                        <div className="library-stat-value">{stats.Albums}</div>
                        <div className="library-stat-label">Albums</div>
                    </div>
                    <div className="library-stat-box">
                        <GiTv size={24} color="var(--border-gold)" />
                        <div className="library-stat-value">{stats.Shows}</div>
                        <div className="library-stat-label">Shows</div>
                    </div>
                    <div className="library-stat-box">
                        <GiGamepad size={24} color="var(--border-gold)" />
                        <div className="library-stat-value">{stats.Games}</div>
                        <div className="library-stat-label">Games</div>
                    </div>
                </div>
            </div>

            {/* NOW CONSUMING SHELF */}
            <div className="library-now-consuming-container">
                <h3 className="library-now-consuming-title">
                    {getLabel('nowConsuming')}
                </h3>

                {nowConsuming.length === 0 ? (
                    <div className="library-empty-state">
                        Nothing {getLabel('nowConsuming').toLowerCase()}.
                    </div>
                ) : (
                    <div className="library-consuming-list">
                        {nowConsuming.map(item => (
                            <div key={item.id} className="library-item-card">
                                <div className="library-item-poster">
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.title} className="library-item-image" />
                                    ) : (
                                        <div className="library-item-placeholder">?</div>
                                    )}
                                </div>
                                <div className="library-item-title">{item.title}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LibraryStats;
