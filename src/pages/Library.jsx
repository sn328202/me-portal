import React, { useState, useMemo } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { GiBookshelf, GiBookCover, GiFilmStrip, GiCompactDisc, GiTv, GiQuill, GiTrashCan, GiCheckMark, GiExpand, GiGamepad } from 'react-icons/gi';
import { FaStar } from 'react-icons/fa';

const Library = () => {
    const { items, loading, error, addItem, updateItem, deleteItem } = useLibrary();
    const [activeTab, setActiveTab] = useState('Book'); // 'Book', 'Movie', 'Album', 'TV Show'
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Form State
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    const [newItem, setNewItem] = useState({
        title: '',
        creator: '',
        type: 'Book',
        status: 'Not Started',
        rating: 0,
        review: '',
        image_url: '',
        link: ''
    });

    const types = ['Book', 'Movie', 'Album', 'TV Show', 'Game'];
    const statuses = ['Not Started', 'In Progress', 'Completed', 'Dropped'];

    const [filterStatus, setFilterStatus] = useState('All');
    const [sortBy, setSortBy] = useState('Date Added'); // 'Date Added', 'Rating', 'Title'

    const processedItems = useMemo(() => {
        let result = items.filter(i => i.type === activeTab);

        // Filter
        if (filterStatus !== 'All') {
            result = result.filter(i => i.status === filterStatus);
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === 'Rating') return (b.rating || 0) - (a.rating || 0);
            if (sortBy === 'Title') return (a.title || '').localeCompare(b.title || '');
            // Default: Date Added (Desc) - the hook already returns items newest-first,
            // so the incoming order is what we want.
            return 0;
        });

        return result;
    }, [items, activeTab, filterStatus, sortBy]);

    const stats = useMemo(() => {
        const count = processedItems.length;
        const ratedItems = processedItems.filter(i => i.rating > 0);
        const avgRating = ratedItems.length > 0
            ? (ratedItems.reduce((acc, curr) => acc + curr.rating, 0) / ratedItems.length).toFixed(1)
            : '0.0';
        return { count, avgRating };
    }, [processedItems]);

    const searchiTunes = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setSearching(true);
        try {
            if (activeTab === 'TV Show') {
                // TVMaze API
                const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(searchQuery)}`);
                const data = await res.json();
                setSearchResults(data.map(item => ({
                    title: item.show.name,
                    creator: item.show.network?.name || item.show.webChannel?.name || 'Unknown Network',
                    image_url: item.show.image?.original || item.show.image?.medium || '',
                    link: item.show.url,
                    date: item.show.premiered ? item.show.premiered.substring(0, 4) : ''
                })));
            } else if (activeTab === 'Movie') {
                // Free Movie DB API (IMDb wrapper)
                const res = await fetch(`https://imdb.iamidiotareyoutoo.com/search?q=${encodeURIComponent(searchQuery)}`);
                const data = await res.json();

                if (data.ok && data.description) {
                    setSearchResults(data.description.map(item => ({
                        title: item['#TITLE'],
                        creator: item['#ACTORS'] || `Year: ${item['#YEAR']}`,
                        image_url: item['#IMG_POSTER'],
                        link: item['#IMDB_URL'],
                        date: item['#YEAR'] ? String(item['#YEAR']) : ''
                    })));
                } else {
                    setSearchResults([]);
                }
            } else {
                // iTunes for Books & Albums
                const searchConfig = {
                    'Book': { media: 'ebook', entity: 'ebook', titleField: 'trackName', creatorField: 'artistName' },
                    'Album': { media: 'music', entity: '', titleField: 'collectionName', creatorField: 'artistName' },
                    'Game': { media: 'software', entity: 'software', titleField: 'trackName', creatorField: 'artistName' }
                };

                const config = searchConfig[activeTab];
                if (!config) return; // Should not happen given logic above

                // Use US store for best coverage, increase limit
                let url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=${config.media}&country=US&limit=25`;
                if (config.entity) url += `&entity=${config.entity}`;

                const res = await fetch(url);
                const data = await res.json();

                // Filter results to remove noise (e.g. Singles for Albums)
                const validResults = data.results.filter(item => {
                    if (activeTab === 'Album') {
                        // "MAYHEM" by Lady Gaga returns collectionType: undefined, so we must allow that.
                        // We strictly rely on trackCount > 1 to filter out singles/songs.
                        const isAlbum = item.collectionType === 'Album' || !item.collectionType;
                        return isAlbum && item.trackCount > 1;
                    }
                    return true;
                });

                setSearchResults(validResults.map(item => {
                    const title = item[config.titleField] || item.collectionName || item.trackName;
                    const creator = item[config.creatorField] || item.artistName;

                    return {
                        title: title,
                        creator: creator,
                        image_url: (item.artworkUrl100 || '').replace('100x100', '600x600'),
                        link: item.trackViewUrl || item.collectionViewUrl,
                        date: item.releaseDate ? item.releaseDate.substring(0, 4) : ''
                    };
                }));
            }
        } catch (err) {
            console.error(err);
            alert('Search failed. The archives are silent.');
        } finally {
            setSearching(false);
        }
    };

    const addSearchResult = (result) => {
        setNewItem({
            ...newItem,
            title: result.title,
            creator: result.creator,
            image_url: result.image_url,
            link: result.link,
            type: activeTab,
            status: 'Not Started'
        });
        setShowSearch(false);
        setIsFormOpen(true);
        setSearchResults([]);
        setSearchQuery('');
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setNewItem({ ...item });
        setIsFormOpen(true);
        setShowSearch(false);
    };

    const handleDelete = async (id) => {
        if (confirm('Remove this work from the library?')) {
            await deleteItem(id);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await updateItem({ ...newItem, id: editingItem.id, type: activeTab }); // Force type to match tab usually, or keep original? keeping state is safer
            } else {
                await addItem({ ...newItem, type: activeTab });
            }
            setIsFormOpen(false);
            setEditingItem(null);
            setNewItem({ title: '', creator: '', type: activeTab, status: 'Not Started', rating: 0, review: '', image_url: '', link: '' });
        } catch (err) {
            alert('Error saving item');
        }
    };

    // Auto-fill logic (copied and adapted from Treasury)
    const handleAutoFill = async () => {
        if (!newItem.link) return;
        try {
            const btn = document.getElementById('autofill-btn');
            const originalText = btn.innerText;
            btn.innerText = '✨ Casting...';
            btn.disabled = true;

            const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(newItem.link)}`);
            const data = await response.json();

            if (data.status === 'success') {
                const { title, image, description, publisher } = data.data;
                setNewItem(prev => ({
                    ...prev,
                    title: prev.title || title || '',
                    image_url: prev.image_url || (image?.url) || '',
                    creator: prev.creator || publisher || '' // Fallback creator
                }));
            }
            btn.innerText = originalText;
            btn.disabled = false;
        } catch (e) {
            console.error(e);
            alert('Could not magically fetch details.');
            document.getElementById('autofill-btn').innerText = '✨ Auto-Fill';
            document.getElementById('autofill-btn').disabled = false;
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-gold)' }}>Opening the archives...</div>;

    return (
        <div className="library-container" style={{ maxWidth: '1400px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h1 className="box-header" style={{ fontSize: '2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <GiBookshelf /> The Library
                </h1>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => {
                            setShowSearch(!showSearch);
                            setIsFormOpen(false);
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '0.5rem 1rem', background: 'transparent',
                            border: '1px solid var(--border-gold)', color: 'var(--text-gold)',
                            fontFamily: 'var(--font-display)', cursor: 'pointer'
                        }}
                    >
                        {showSearch ? 'Close Search' : '🔍 Find & Add'}
                    </button>
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setNewItem({ title: '', creator: '', type: activeTab, status: 'Not Started', rating: 0, review: '', image_url: '', link: '' });
                            setIsFormOpen(true);
                            setShowSearch(false);
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-sm)',
                            padding: 'var(--space-sm) var(--space-md)',
                            border: '1px solid var(--accent-gold)',
                            background: 'rgba(207, 181, 59, 0.1)',
                            color: 'var(--text-gold)',
                            fontFamily: 'var(--font-display)',
                            textTransform: 'uppercase',
                            cursor: 'pointer'
                        }}
                    >
                        <GiQuill /> Manual Entry
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border-dim)', paddingBottom: 'var(--space-sm)' }}>
                {types.map((type) => (
                    <button
                        key={type}
                        onClick={() => { setActiveTab(type); setSearchResults([]); setSearchQuery(''); }}
                        style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'transparent',
                            border: 'none',
                            color: activeTab === type ? 'var(--accent-crimson)' : 'var(--text-muted)',
                            fontFamily: 'var(--font-display)',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            cursor: 'pointer',
                            borderBottom: activeTab === type ? '2px solid var(--accent-crimson)' : '2px solid transparent',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {type === 'Book' && <GiBookCover />}
                        {type === 'Movie' && <GiFilmStrip />}
                        {type === 'Album' && <GiCompactDisc />}
                        {type === 'TV Show' && <GiTv />}
                        {type === 'Game' && <GiGamepad />}
                        {type}s
                    </button>
                ))}
            </div>

            {/* Controls & Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)' }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Items</span>
                        <span style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-main)' }}>{stats.count}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Rating</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-gold)' }}>{stats.avgRating}</span>
                            <FaStar color="var(--accent-gold)" />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{ padding: '0.5rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-dim)' }}
                    >
                        <option value="All">All Statuses</option>
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{ padding: '0.5rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-dim)' }}
                    >
                        <option value="Date Added">Date Added (Newest)</option>
                        <option value="Rating">Highest Rated</option>
                        <option value="Title">Title (A-Z)</option>
                    </select>
                </div>
            </div>

            {/* SEARCH INTERFACE */}
            {showSearch && !isFormOpen && (
                <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--bg-panel)', border: '1px dashed var(--accent-gold)' }}>
                    <form onSubmit={searchiTunes} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <input
                            autoFocus
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search for a ${activeTab}...`}
                            style={{ flex: 1, padding: '1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-dim)', color: 'var(--text-main)', fontSize: '1.2rem' }}
                        />
                        <button
                            type="submit"
                            disabled={searching}
                            style={{ padding: '0 2rem', background: 'var(--accent-gold)', color: 'var(--bg-main)', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                        >
                            {searching ? 'Searching...' : 'Search'}
                        </button>
                    </form>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                        gap: '2rem'
                    }}>
                        {searchResults.map((item, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => addSearchResult(item)}
                                aria-label={`Add ${item.title} to the archive`}
                                style={{ display: 'block', width: '100%', padding: 0, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', border: '1px solid var(--border-dim)', background: 'rgba(0,0,0,0.2)', transition: 'transform 0.2s' }}
                            >
                                <div style={{ aspectRatio: '1/1.5', overflow: 'hidden' }}>
                                    <img src={item.image_url} alt={`Cover art for ${item.title}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div style={{ padding: '0.5rem' }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{item.title}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.creator} {item.date && `(${item.date})`}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-gold)', marginTop: '4px' }}>+ Bequeath</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Grid */}
            {!isFormOpen && !showSearch ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-lg)', overflowY: 'auto', paddingRight: '10px' }}>
                    {processedItems.map(item => (
                        <div key={item.id} style={{
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-dim)',
                            position: 'relative',
                            transition: 'transform 0.2s',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Cover Image */}
                            <div style={{ aspectRatio: item.type === 'Movie' || item.type === 'Book' || item.type === 'TV Show' ? '2/3' : '1/1', background: '#222', overflow: 'hidden', position: 'relative' }}>
                                {item.image_url ? (
                                    <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                        No Cover
                                    </div>
                                )}

                                {/* Status Badge */}
                                <div style={{
                                    position: 'absolute', top: 5, right: 5,
                                    background: item.status === 'Completed' ? 'var(--accent-green)' : 'rgba(0,0,0,0.8)',
                                    color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px'
                                }}>
                                    {item.status}
                                </div>
                            </div>

                            {/* Info */}
                            <div style={{ padding: '0.8rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>{item.title}</h3>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{item.creator}</div>

                                {/* Rating Stars */}
                                <div style={{ display: 'flex', gap: '2px', color: 'var(--accent-gold)', marginBottom: '8px' }}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <FaStar key={star} style={{ opacity: star <= (item.rating || 0) ? 1 : 0.3 }} />
                                    ))}
                                </div>

                                {/* Link */}
                                {item.link && (
                                    <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--text-gold)', textDecoration: 'none', marginBottom: '8px' }}>
                                        View Source ↗
                                    </a>
                                )}

                                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-dim)' }}>
                                    <button onClick={() => handleEdit(item)} aria-label={`Edit ${item.title}`} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}><GiQuill /></button>
                                    <button onClick={() => handleDelete(item.id)} aria-label={`Delete ${item.title}`} style={{ background: 'none', border: 'none', color: 'var(--accent-crimson)', cursor: 'pointer' }}><GiTrashCan /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {processedItems.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                            No {activeTab.toLowerCase()}s in the archives. Catalog one now.
                        </div>
                    )}
                </div>
            ) : isFormOpen ? (
                /* Form View */
                <div style={{ maxWidth: '600px', margin: '0 auto', background: 'var(--bg-panel)', border: 'var(--border-double)', padding: 'var(--space-xl)', width: '100%' }}>
                    <h2 style={{ textAlign: 'center', color: 'var(--text-gold)', fontFamily: 'var(--font-display)', marginBottom: '2rem' }}>
                        {editingItem ? 'Edit Entry' : `New ${activeTab} Entry`}
                    </h2>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                Link (Auto-Fill Source)
                                {newItem.link && <button id="autofill-btn" type="button" onClick={handleAutoFill} style={{ marginLeft: '10px', fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer', background: 'none', border: '1px solid var(--accent-gold)', color: 'var(--text-gold)', borderRadius: '4px' }}>✨ Auto-Fill</button>}
                            </label>
                            <input
                                type="url"
                                value={newItem.link}
                                onChange={e => setNewItem({ ...newItem, link: e.target.value })}
                                placeholder="https://..."
                                style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Title</label>
                            <input
                                type="text"
                                required
                                value={newItem.title}
                                onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                                style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Creator (Author/Director/Artist)</label>
                            <input
                                type="text"
                                value={newItem.creator}
                                onChange={e => setNewItem({ ...newItem, creator: e.target.value })}
                                style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Status</label>
                                <select
                                    value={newItem.status}
                                    onChange={e => setNewItem({ ...newItem, status: e.target.value })}
                                    style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                >
                                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Rating</label>
                                <div style={{ display: 'flex', gap: '5px', padding: '0.8rem', alignItems: 'center' }}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <FaStar
                                            key={star}
                                            onClick={() => setNewItem({ ...newItem, rating: star })}
                                            style={{
                                                cursor: 'pointer',
                                                color: star <= newItem.rating ? 'var(--accent-gold)' : 'var(--text-muted)',
                                                fontSize: '1.2rem'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Image URL</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <input
                                    type="url"
                                    value={newItem.image_url || ''}
                                    onChange={e => setNewItem({ ...newItem, image_url: e.target.value })}
                                    placeholder="https://..."
                                    style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                />
                                {newItem.image_url && (
                                    <div style={{ width: '50px', height: '75px', border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                                        <img src={newItem.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Review / Notes</label>
                            <textarea
                                value={newItem.review || ''}
                                onChange={e => setNewItem({ ...newItem, review: e.target.value })}
                                rows={4}
                                style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)', fontFamily: 'var(--font-body)' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button type="button" onClick={() => setIsFormOpen(false)} style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                            <button type="submit" style={{ flex: 1, padding: '1rem', background: 'var(--accent-crimson)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Save to Library</button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
};

export default Library;
