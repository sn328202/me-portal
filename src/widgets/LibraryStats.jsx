import React, { useMemo } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { GiBookshelf, GiFilmStrip, GiCompactDisc, GiTv, GiGamepad } from 'react-icons/gi';

const LibraryStats = () => {
    const { items, loading } = useLibrary();

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

    if (loading) return <div style={{ padding: '1rem', color: '#8d6e63' }}>Loading Archive...</div>;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-main)', padding: '1.5rem 0' }}>

            {/* KPI STATS */}
            <div>
                <h3 style={{ margin: '0 0 1rem 0', fontFamily: 'Playfair Display, serif', color: '#cfb53b', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>
                    Archives Consumed
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                    <div className="stat-box">
                        <GiBookshelf size={24} color="#a1887f" />
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.Books}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>Books</div>
                    </div>
                    <div className="stat-box">
                        <GiFilmStrip size={24} color="#a1887f" />
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.Movies}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>Movies</div>
                    </div>
                    <div className="stat-box">
                        <GiCompactDisc size={24} color="#a1887f" />
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.Albums}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>Albums</div>
                    </div>
                    <div className="stat-box">
                        <GiTv size={24} color="#a1887f" />
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.Shows}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>Shows</div>
                    </div>
                    <div className="stat-box">
                        <GiGamepad size={24} color="#a1887f" />
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.Games}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>Games</div>
                    </div>
                </div>
            </div>

            {/* NOW CONSUMING SHELF */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '1rem 0', fontFamily: 'var(--font-display)', color: 'var(--text-gold)', borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.5rem' }}>
                    Now Consuming
                </h3>

                {nowConsuming.length === 0 ? (
                    <div style={{ fontStyle: 'italic', color: '#666', textAlign: 'center', marginTop: '1rem' }}>
                        Nothing in progress.
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        overflowX: 'auto',
                        paddingBottom: '0.5rem',
                        alignItems: 'center'
                    }}>
                        {nowConsuming.map(item => (
                            <div key={item.id} style={{ minWidth: '80px', maxWidth: '80px', textAlign: 'center' }}>
                                <div style={{
                                    width: '80px', height: '120px',
                                    borderRadius: '4px', overflow: 'hidden',
                                    marginBottom: '0.5rem',
                                    border: '1px solid #444',
                                    position: 'relative'
                                }}>
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>?</div>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.7rem', maxHeight: '2.4em', overflow: 'hidden', lineHeight: '1.2' }}>{item.title}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LibraryStats;
