import React, { useState, useMemo } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import {
    GiBookshelf,
    GiBookCover,
    GiFilmStrip,
    GiCompactDisc,
    GiTv,
    GiQuill,
    GiTrashCan,
    GiGamepad,
    GiMagnifyingGlass
} from 'react-icons/gi';
import { FaStar } from 'react-icons/fa';
import {
    Button,
    Card,
    PageHeader,
    Tabs,
    Modal,
    Field,
    Tag,
    Stat,
    ConfirmButton,
    EmptyState
} from '../components/ui';
import ShelfImport from '../components/ShelfImport';
import '../styles/Library.css';

const TYPES = ['Book', 'Movie', 'Album', 'TV Show', 'Game'];

/** "Mar 2026" — the month is the useful grain for a shelf, and the day of the
 *  month is noise nobody has ever wanted from a reading list. */
const finishedLabel = (iso) => {
    const [y, m] = String(iso).split('-');
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1];
    return month ? `${month} ${y}` : y;
};
const STATUSES = ['Not Started', 'In Progress', 'Completed', 'Dropped'];

const TYPE_ICONS = {
    'Book': <GiBookCover />,
    'Movie': <GiFilmStrip />,
    'Album': <GiCompactDisc />,
    'TV Show': <GiTv />,
    'Game': <GiGamepad />
};

const EMPTY_ITEM = {
    title: '',
    creator: '',
    type: 'Book',
    status: 'Not Started',
    rating: 0,
    review: '',
    image_url: '',
    link: ''
};

// Tall covers for the printed/filmed things, square for the rest.
const coverAspect = (type) =>
    type === 'Movie' || type === 'Book' || type === 'TV Show' ? '2 / 3' : '1 / 1';

/**
 * One card for one work. The shelf and the search results used to draw the
 * same object two different ways; this is the single design, rendered as a
 * <section> on the shelf and as a <button> in the results.
 */
const MediaCard = ({ title, creator, cover, aspect, badge, children, ...rest }) => {
    // A heading on the shelf; a span inside the result button, where a
    // heading would not be valid content.
    const Title = rest.titleAs || 'h3';
    delete rest.titleAs;

    return (
        <Card
            variant="flat"
            padded={false}
            interactive
            className="media-card"
            bodyClassName="media-card__body"
            {...rest}
        >
            <div className="media-card__cover" style={{ aspectRatio: aspect }}>
                {cover ? (
                    <img src={cover} alt={`Cover art for ${title}`} loading="lazy" />
                ) : (
                    <span className="media-card__nocover">No Cover</span>
                )}
                {badge}
            </div>
            <div className="media-card__info">
                <Title className="media-card__title">{title}</Title>
                {creator && <span className="media-card__creator">{creator}</span>}
                {children}
            </div>
        </Card>
    );
};

/*
 * Half stars, because Letterboxd rates in them.
 *
 * Rounding 3.5 down to 3 on the way in would be a small lie about what she
 * thought of a film, told silently, on every import — so the column holds
 * halves and this draws them: a full star underneath, a clipped one over it.
 */
const Rating = ({ value = 0 }) => {
    const v = Number(value) || 0;
    return (
        <div className="rating" role="img" aria-label={`Rated ${v || 0} out of 5`}>
            {[1, 2, 3, 4, 5].map(star => {
                const fill = Math.max(0, Math.min(1, v - star + 1));
                return (
                    <span key={star} className="rating__slot">
                        <FaStar className="rating__star" />
                        {fill > 0 && (
                            <span className="rating__fill" style={{ width: `${fill * 100}%` }}>
                                <FaStar className="rating__star rating__star--on" />
                            </span>
                        )}
                    </span>
                );
            })}
        </div>
    );
};

const Library = () => {
    const { items, loading, error, addItem, updateItem, deleteItem, reload } = useLibrary();
    const [activeTab, setActiveTab] = useState('Book'); // 'Book', 'Movie', 'Album', 'TV Show', 'Game'
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    const [newItem, setNewItem] = useState(EMPTY_ITEM);
    const [casting, setCasting] = useState(false);

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
            /* When she actually finished it, which for an imported shelf is
               the only ordering that means anything — everything arrived on
               the same afternoon, so "date added" says nothing at all.
               Anything undated goes last rather than pretending to be old. */
            if (sortBy === 'Finished') {
                const A = a.finished_at || '';
                const B = b.finished_at || '';
                if (!A && !B) return 0;
                if (!A) return 1;
                if (!B) return -1;
                return B.localeCompare(A);
            }
            // Default: Date Added (Desc) - the hook already returns items newest-first,
            // so the incoming order is what we want.
            return 0;
        });

        return result;
    }, [items, activeTab, filterStatus, sortBy]);

    const tabs = useMemo(
        () => TYPES.map(type => ({
            id: type,
            label: `${type}s`,
            icon: TYPE_ICONS[type],
            count: items.filter(i => i.type === type).length
        })),
        [items]
    );

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
        setEditingItem(null);
        setNewItem({
            ...EMPTY_ITEM,
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

    const openManualEntry = () => {
        setEditingItem(null);
        setNewItem({ ...EMPTY_ITEM, type: activeTab });
        setIsFormOpen(true);
        setShowSearch(false);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setNewItem({ ...item });
        setIsFormOpen(true);
        setShowSearch(false);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingItem(null);
        setCasting(false);
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
            setNewItem({ ...EMPTY_ITEM, type: activeTab });
        } catch {
            alert('Error saving item');
        }
    };

    // Auto-fill logic (the same spell the Treasury casts)
    const handleAutoFill = async () => {
        if (!newItem.link) return;
        setCasting(true);
        try {
            const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(newItem.link)}`);
            const data = await response.json();

            if (data.status === 'success') {
                const { title, image, publisher } = data.data;
                setNewItem(prev => ({
                    ...prev,
                    title: prev.title || title || '',
                    image_url: prev.image_url || (image?.url) || '',
                    creator: prev.creator || publisher || '' // Fallback creator
                }));
            }
        } catch (e) {
            console.error(e);
            alert('Could not magically fetch details.');
        } finally {
            setCasting(false);
        }
    };

    if (loading) return <div className="archives-loading">Opening the archives...</div>;

    return (
        <div className="page library-page">
            <PageHeader
                title="The Library"
                icon={<GiBookshelf />}
                subtitle="Every work consumed, kept on the shelf."
                actions={
                    <>
                        <Button onClick={() => { setShowSearch(true); setIsFormOpen(false); }}>
                            <GiMagnifyingGlass /> Find &amp; Add
                        </Button>
                        <Button variant="primary" onClick={openManualEntry}>
                            <GiQuill /> Manual Entry
                        </Button>
                    </>
                }
            />

            <Tabs
                tabs={tabs}
                active={activeTab}
                onChange={(type) => { setActiveTab(type); setSearchResults([]); setSearchQuery(''); }}
                label="Media types"
            />

            {error && <p className="muted">{error}</p>}

            <Card variant="flat">
                <div className="library-toolbar">
                    <div className="stat-row library-toolbar__stats">
                        <Stat value={stats.count} label="Items" />
                        <Stat value={stats.avgRating} label="Avg Rating" icon={<FaStar />} />
                    </div>

                    <div className="library-toolbar__filters">
                        <Field label="Status">
                            <select
                                className="select"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="All">All Statuses</option>
                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>
                        <Field label="Sort">
                            <select
                                className="select"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="Date Added">Date Added (Newest)</option>
                                <option value="Finished">Finished (Newest)</option>
                                <option value="Rating">Highest Rated</option>
                                <option value="Title">Title (A-Z)</option>
                            </select>
                        </Field>
                    </div>
                </div>

                {/* A shelf she has already kept somewhere else for years.
                    Neither Goodreads nor Letterboxd will answer an API, but
                    both hand over a file, so a file is the way in. */}
                <ShelfImport items={items} onDone={reload} />
            </Card>

            {/* The shelf */}
            {processedItems.length === 0 ? (
                filterStatus === 'All' ? (
                    <EmptyState
                        icon={TYPE_ICONS[activeTab]}
                        message={`No ${activeTab.toLowerCase()}s in the archives.`}
                        hint="Catalog one now."
                        actionLabel="Find & Add"
                        onAction={() => { setShowSearch(true); setIsFormOpen(false); }}
                    />
                ) : (
                    <EmptyState
                        icon={TYPE_ICONS[activeTab]}
                        message={`No ${activeTab.toLowerCase()}s marked "${filterStatus}".`}
                        actionLabel="Show All Statuses"
                        onAction={() => setFilterStatus('All')}
                    />
                )
            ) : (
                <div className="shelf-grid">
                    {processedItems.map(item => (
                        <MediaCard
                            key={item.id}
                            title={item.title}
                            creator={item.creator}
                            cover={item.image_url}
                            aspect={coverAspect(item.type)}
                            badge={
                                <Tag
                                    className="media-card__status"
                                    tone={item.status === 'Completed' ? 'green' : 'default'}
                                >
                                    {item.status}
                                </Tag>
                            }
                        >
                            <Rating value={item.rating} />

                            {/* When she finished it, and when it was made.
                                On an imported shelf this is the only date that
                                means anything — they all arrived at once. */}
                            {(item.finished_at || item.year) && (
                                <span className="media-card__when">
                                    {item.finished_at && finishedLabel(item.finished_at)}
                                    {item.finished_at && item.year && ' · '}
                                    {item.year && <em>{item.year}</em>}
                                </span>
                            )}

                            {item.link && (
                                <a
                                    className="media-card__link"
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View Source ↗
                                </a>
                            )}

                            <div className="media-card__footer">
                                <Button
                                    icon
                                    size="sm"
                                    label={`Edit ${item.title}`}
                                    onClick={() => handleEdit(item)}
                                >
                                    <GiQuill />
                                </Button>
                                <ConfirmButton
                                    label={`Remove ${item.title}`}
                                    confirmLabel="Remove this work?"
                                    icon={<GiTrashCan />}
                                    onConfirm={() => deleteItem(item.id)}
                                />
                            </div>
                        </MediaCard>
                    ))}
                </div>
            )}

            {/* --- FIND & ADD --- */}
            <Modal
                open={showSearch}
                onClose={() => setShowSearch(false)}
                title={`Find a ${activeTab}`}
                size="wide"
            >
                <form className="search-form" onSubmit={searchiTunes}>
                    <Field
                        label="Search the archives"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={`Search for a ${activeTab}...`}
                    />
                    <Button variant="solid" type="submit" disabled={searching}>
                        {searching ? 'Searching...' : 'Search'}
                    </Button>
                </form>

                {searchResults.length === 0 ? (
                    <EmptyState
                        inline
                        icon={<GiMagnifyingGlass />}
                        message={searching ? 'Consulting the archives...' : 'Nothing summoned yet.'}
                        hint="Search by title, then choose a work to bequeath to the shelf."
                    />
                ) : (
                    <div className="search-results">
                        {searchResults.map((result, idx) => (
                            <MediaCard
                                key={idx}
                                as="button"
                                type="button"
                                className="media-card media-card--result"
                                titleAs="span"
                                title={result.title}
                                creator={`${result.creator}${result.date ? ` (${result.date})` : ''}`}
                                cover={result.image_url}
                                aspect={coverAspect(activeTab)}
                                aria-label={`Add ${result.title} to the archive`}
                                onClick={() => addSearchResult(result)}
                            >
                                <span className="media-card__cta">+ Bequeath</span>
                            </MediaCard>
                        ))}
                    </div>
                )}
            </Modal>

            {/* --- ENTRY FORM --- */}
            <Modal
                open={isFormOpen}
                onClose={closeForm}
                title={editingItem ? 'Edit Entry' : `New ${activeTab} Entry`}
                footer={
                    <>
                        <Button onClick={closeForm}>Cancel</Button>
                        <Button variant="solid" type="submit" form="library-form">Save to Library</Button>
                    </>
                }
            >
                <form id="library-form" className="stack" onSubmit={handleSubmit}>
                    <div className="field-with-action">
                        <Field
                            label="Link"
                            hint="Auto-Fill source."
                            type="url"
                            placeholder="https://..."
                            value={newItem.link}
                            onChange={e => setNewItem({ ...newItem, link: e.target.value })}
                        />
                        {newItem.link && (
                            <Button size="sm" disabled={casting} onClick={handleAutoFill}>
                                {casting ? '✨ Casting...' : '✨ Auto-Fill'}
                            </Button>
                        )}
                    </div>

                    <Field
                        label="Title"
                        type="text"
                        required
                        value={newItem.title}
                        onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                    />

                    <Field
                        label="Creator"
                        hint="Author / Director / Artist."
                        type="text"
                        value={newItem.creator}
                        onChange={e => setNewItem({ ...newItem, creator: e.target.value })}
                    />

                    <div className="field-row">
                        <Field label="Status">
                            <select
                                className="select"
                                value={newItem.status}
                                onChange={e => setNewItem({ ...newItem, status: e.target.value })}
                            >
                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>

                        <div className="field">
                            <span className="field__label">Rating</span>
                            <div className="rating-input" role="group" aria-label="Rating">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        aria-label={`${star} of 5`}
                                        aria-pressed={star <= (newItem.rating || 0)}
                                        onClick={() => setNewItem({ ...newItem, rating: star })}
                                    >
                                        <FaStar />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="field-with-image">
                        <Field
                            label="Image URL"
                            type="url"
                            placeholder="https://..."
                            value={newItem.image_url || ''}
                            onChange={e => setNewItem({ ...newItem, image_url: e.target.value })}
                        />
                        {newItem.image_url && (
                            <div className="cover-thumb">
                                <img src={newItem.image_url} alt="Preview" />
                            </div>
                        )}
                    </div>

                    <Field
                        label="Review / Notes"
                        as="textarea"
                        rows={4}
                        value={newItem.review || ''}
                        onChange={e => setNewItem({ ...newItem, review: e.target.value })}
                    />
                </form>
            </Modal>
        </div>
    );
};

export default Library;
