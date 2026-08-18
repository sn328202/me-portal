import React, { useState, useMemo } from 'react';
import { useTreasury } from '../hooks/useTreasury';
import { GiOpenTreasureChest, GiQuill, GiTrashCan, GiCheckMark, GiDiamonds, GiPriceTag, GiShop, GiCoins, GiMagnifyingGlass, GiSettingsKnobs } from 'react-icons/gi';

const Treasury = () => {
    const { items, brands, loading, error, addItem, updateItem, deleteItem, addBrand, deleteBrand } = useTreasury();
    const [viewMode, setViewMode] = useState('ledger'); // 'ledger' or 'vision'
    const [activeTab, setActiveTab] = useState('desires'); // 'desires' or 'brands'

    // Desires Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [newItem, setNewItem] = useState({
        title: '',
        category: 'Home',
        price: '',
        link: '',
        image_url: '',
        priority: 'Medium'
    });

    // Brands Form State
    const [isBrandFormOpen, setIsBrandFormOpen] = useState(false);
    const [newBrand, setNewBrand] = useState({
        name: '',
        link: '',
        tags: '', // comma separated string for input
        notes: '',
        image_url: ''
    });

    // Brands Filtering State
    const [brandSearch, setBrandSearch] = useState('');
    const [brandFilterTag, setBrandFilterTag] = useState('');
    const [brandSort, setBrandSort] = useState('name-asc');

    // Derived Brand Data
    const uniqueBrandTags = useMemo(() => {
        const allTags = brands.flatMap(b => b.tags || []);
        return Array.from(new Set(allTags)).sort();
    }, [brands]);

    const filteredBrands = useMemo(() => {
        let result = [...brands];

        // Search
        if (brandSearch) {
            const lowerQuery = brandSearch.toLowerCase();
            result = result.filter(b =>
                (b.name || '').toLowerCase().includes(lowerQuery) ||
                (b.notes || '').toLowerCase().includes(lowerQuery)
            );
        }

        // Filter
        if (brandFilterTag) {
            result = result.filter(b => (b.tags || []).includes(brandFilterTag));
        }

        // Sort
        result.sort((a, b) => {
            if (brandSort === 'name-asc') return (a.name || '').localeCompare(b.name || '');
            if (brandSort === 'name-desc') return (b.name || '').localeCompare(a.name || '');
            if (brandSort === 'newest') return (b.id || 0) - (a.id || 0);
            if (brandSort === 'oldest') return (a.id || 0) - (b.id || 0);
            return 0;
        });

        return result;
    }, [brands, brandSearch, brandFilterTag, brandSort]);

    const categories = ['Home', 'Kitchen', 'Closet', 'Books', 'Tech', 'Personal Care', 'Other'];
    const priorities = ['High', 'Medium', 'Low'];

    // --- Handlers for Desires ---
    const handleEdit = (item) => {
        setEditingItem(item);
        setNewItem({ ...item }); // Pre-fill form
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Discard this desire?')) {
            await deleteItem(id);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await updateItem({ ...newItem, id: editingItem.id });
            } else {
                await addItem(newItem);
            }
            setIsFormOpen(false);
            setEditingItem(null);
            setNewItem({ title: '', category: 'Home', price: '', link: '', image_url: '', priority: 'Medium' });
        } catch (err) {
            alert('Error saving item');
        }
    };

    const toggleStatus = async (item) => {
        const newStatus = item.status === 'acquired' ? 'desired' : 'acquired';
        await updateItem({ ...item, status: newStatus });
    };

    // --- Handlers for Brands ---
    const handleBrandSubmit = async (e) => {
        e.preventDefault();
        try {
            const tagsArray = newBrand.tags.split(',').map(t => t.trim()).filter(t => t);
            await addBrand({ ...newBrand, tags: tagsArray });
            setIsBrandFormOpen(false);
            setNewBrand({ name: '', link: '', tags: '', notes: '', image_url: '' });
        } catch (err) {
            alert('Error saving brand');
        }
    };

    const [deletingBrandId, setDeletingBrandId] = useState(null);

    const handleDeleteBrand = async (id) => {
        if (deletingBrandId === id) {
            await deleteBrand(id);
            setDeletingBrandId(null);
        } else {
            setDeletingBrandId(id);
            setTimeout(() => setDeletingBrandId(null), 3000); // Reset after 3s
        }
    };

    // Helper: Parse price string to number (remove $, commas, etc)
    const parsePrice = (priceStr) => {
        if (!priceStr) return 0;
        // Match first sequence of digits/dots
        const match = priceStr.match(/(\d+(\.\d{1,2})?)/);
        return match ? parseFloat(match[0]) : 0;
    };

    // Group items by category
    const groupedData = useMemo(() => {
        return categories.reduce((acc, cat) => {
            const catItems = items.filter(i => i.category === cat);
            const totalCost = catItems.reduce((sum, item) => sum + parsePrice(item.price), 0);
            acc[cat] = { items: catItems, total: totalCost };
            return acc;
        }, {});
    }, [items]);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-gold)' }}>Loading ledger...</div>;

    return (
        <div className="treasury-container" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                <h1 className="box-header" style={{ fontSize: '2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <GiOpenTreasureChest /> The Treasury
                </h1>

                {/* Main Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-panel)', padding: '5px', borderRadius: '4px', border: '1px solid var(--border-dim)' }}>
                    <button
                        onClick={() => setActiveTab('desires')}
                        style={{
                            padding: '0.5rem 1rem',
                            background: activeTab === 'desires' ? 'var(--text-gold)' : 'transparent',
                            color: activeTab === 'desires' ? 'var(--bg-main)' : 'var(--text-muted)',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            borderRadius: '2px'
                        }}
                    >
                        <GiDiamonds style={{ marginRight: '5px' }} /> Desires
                    </button>
                    <button
                        onClick={() => setActiveTab('brands')}
                        style={{
                            padding: '0.5rem 1rem',
                            background: activeTab === 'brands' ? 'var(--text-gold)' : 'transparent',
                            color: activeTab === 'brands' ? 'var(--bg-main)' : 'var(--text-muted)',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            borderRadius: '2px'
                        }}
                    >
                        <GiShop style={{ marginRight: '5px' }} /> Brands
                    </button>
                </div>
            </div>

            {/* --- DESIRES TAB --- */}
            {activeTab === 'desires' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
                        <button
                            onClick={() => setViewMode(viewMode === 'ledger' ? 'vision' : 'ledger')}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border-gold)',
                                color: 'var(--text-gold)',
                                padding: '0.5rem 1rem',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-display)'
                            }}
                        >
                            {viewMode === 'ledger' ? 'View Vision Board' : 'View Ledger'}
                        </button>

                        <button
                            onClick={() => {
                                setEditingItem(null);
                                setNewItem({ title: '', category: 'Home', price: '', link: '', image_url: '', priority: 'Medium' });
                                setIsFormOpen(true);
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
                            <GiQuill /> Log New Desire
                        </button>
                    </div>

                    {/* Form View (Modal-ish or Inline) */}
                    {isFormOpen && (
                        <div style={{
                            maxWidth: '600px',
                            margin: '0 auto 2rem',
                            background: 'var(--bg-panel)',
                            border: 'var(--border-double)',
                            padding: 'var(--space-xl)'
                        }}>
                            <h2 style={{ textAlign: 'center', color: 'var(--text-gold)', fontFamily: 'var(--font-display)', marginBottom: '2rem' }}>
                                {editingItem ? 'Edit Entry' : 'New Entry'}
                            </h2>

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Item Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newItem.title}
                                        onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Category</label>
                                        <select
                                            value={newItem.category}
                                            onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                        >
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Priority</label>
                                        <select
                                            value={newItem.priority}
                                            onChange={e => setNewItem({ ...newItem, priority: e.target.value })}
                                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                        >
                                            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Price (Est.)</label>
                                        <input
                                            type="text"
                                            value={newItem.price}
                                            onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                                            placeholder="$20"
                                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                            Link
                                            {newItem.link && (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (!newItem.link) return;
                                                        try {
                                                            const btn = document.activeElement;
                                                            const originalText = btn.innerText;
                                                            btn.innerText = '✨ Casting...';
                                                            btn.disabled = true;

                                                            const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(newItem.link)}`);
                                                            const data = await response.json();

                                                            if (data.status === 'success') {
                                                                const { title, image, description } = data.data;

                                                                // Update state with found data
                                                                setNewItem(prev => ({
                                                                    ...prev,
                                                                    title: prev.title || title || '',
                                                                    image_url: prev.image_url || (image?.url) || '',
                                                                    // Try to find price in description/title if not set
                                                                    price: prev.price || (description?.match(/\$[\d,]+(\.\d{2})?/) || [])[0] || ''
                                                                }));
                                                            }
                                                            btn.innerText = originalText;
                                                            btn.disabled = false;
                                                        } catch (e) {
                                                            console.error(e);
                                                            alert('Could not magically fetch details. You may need to enter them manually.');
                                                            document.activeElement.innerText = '✨ Auto-Fill';
                                                            document.activeElement.disabled = false;
                                                        }
                                                    }}
                                                    style={{
                                                        marginLeft: '8px',
                                                        background: 'none',
                                                        border: '1px solid var(--accent-gold)',
                                                        color: 'var(--text-gold)',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.7rem',
                                                        padding: '2px 6px'
                                                    }}
                                                >
                                                    ✨ Auto-Fill
                                                </button>
                                            )}
                                        </label>
                                        <input
                                            type="url"
                                            value={newItem.link}
                                            onChange={e => setNewItem({ ...newItem, link: e.target.value })}
                                            placeholder="https://..."
                                            style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Image URL</label>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <input
                                            type="url"
                                            value={newItem.image_url || ''}
                                            onChange={e => setNewItem({ ...newItem, image_url: e.target.value })}
                                            placeholder="https://image-link.com/pic.jpg"
                                            style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                        />
                                        {newItem.image_url && (
                                            <div style={{ width: '50px', height: '50px', border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                                                <img src={newItem.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsFormOpen(false)}
                                        style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{ flex: 1, padding: '1rem', background: 'var(--accent-crimson)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        Save Entry
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* VISION BOARD MODE */}
                    {viewMode === 'vision' && (
                        <div style={{ columns: '250px 4', columnGap: '1rem' }}>
                            {items.filter(i => i.image_url).map(item => (
                                <div key={item.id} style={{ breakInside: 'avoid', marginBottom: '1rem', position: 'relative', overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
                                    {item.link ? (
                                        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
                                            <img src={item.image_url} alt={item.title} style={{ width: '100%', display: 'block', transition: 'transform 0.3s ease' }} />
                                            <div style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                background: 'rgba(0,0,0,0.7)', padding: '0.5rem',
                                                color: 'white', fontSize: '0.8rem'
                                            }}>
                                                {item.title}
                                                <span style={{ float: 'right', fontSize: '1rem' }}>↗</span>
                                            </div>
                                            <style>{`
                                                a:hover img { transform: scale(1.05); }
                                            `}</style>
                                        </a>
                                    ) : (
                                        <>
                                            <img src={item.image_url} alt={item.title} style={{ width: '100%', display: 'block' }} />
                                            <div style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                background: 'rgba(0,0,0,0.7)', padding: '0.5rem',
                                                color: 'white', fontSize: '0.8rem'
                                            }}>
                                                {item.title}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                            {items.filter(i => i.image_url).length === 0 && (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', width: '100%' }}>No images logged yet. Add Image URLs to your items!</p>
                            )}
                        </div>
                    )}

                    {/* LEDGER MODE */}
                    {viewMode === 'ledger' && !isFormOpen && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
                            {categories.map(cat => {
                                const { items: catItems, total } = groupedData[cat] || { items: [], total: 0 };
                                if (catItems.length === 0) return null;

                                return (
                                    <div key={cat} style={{
                                        background: 'var(--bg-panel)',
                                        border: 'var(--border-single)',
                                        padding: 'var(--space-md)',
                                        position: 'relative'
                                    }}>
                                        <div style={{
                                            borderBottom: '1px solid var(--border-dim)',
                                            paddingBottom: '0.5rem',
                                            marginBottom: '1rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <h3 style={{ margin: 0, color: 'var(--text-gold)', fontFamily: 'var(--font-display)' }}>{cat}</h3>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <GiCoins /> Est. ${total.toFixed(2)}
                                            </span>
                                        </div>

                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                            {catItems.map(item => (
                                                <li key={item.id} style={{
                                                    marginBottom: '1rem',
                                                    paddingBottom: '1rem',
                                                    borderBottom: '1px dashed var(--border-dim)',
                                                    opacity: item.status === 'acquired' ? 0.6 : 1
                                                }}>
                                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                                        {/* Thumbnail */}
                                                        {item.image_url && (
                                                            <div style={{ width: '60px', height: '60px', flexShrink: 0, border: '1px solid var(--border-dim)' }}>
                                                                <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </div>
                                                        )}

                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                                                <div>
                                                                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)', textDecoration: item.status === 'acquired' ? 'line-through' : 'none' }}>
                                                                        {item.title}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                                        {item.price && <span style={{ marginRight: '8px' }}>Approx. {item.price}</span>}
                                                                        <span style={{
                                                                            padding: '2px 6px',
                                                                            borderRadius: '4px',
                                                                            background: item.priority === 'High' ? 'rgba(180, 60, 60, 0.2)' : 'rgba(255,255,255,0.05)',
                                                                            fontSize: '0.7rem',
                                                                            border: '1px solid var(--border-dim)'
                                                                        }}>
                                                                            {item.priority} Priority
                                                                        </span>
                                                                    </div>
                                                                    {item.link && (
                                                                        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-gold)', textDecoration: 'underline' }}>
                                                                            View Item
                                                                        </a>
                                                                    )}
                                                                </div>

                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button
                                                                        onClick={() => toggleStatus(item)}
                                                                        title={item.status === 'acquired' ? "Mark as Desired" : "Mark as Acquired"}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.status === 'acquired' ? 'var(--text-gold)' : 'var(--text-muted)' }}
                                                                    >
                                                                        <GiCheckMark />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleEdit(item)}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}
                                                                    >
                                                                        <GiQuill />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(item.id)}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)' }}
                                                                    >
                                                                        <GiTrashCan />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* --- BRANDS TAB --- */}
            {activeTab === 'brands' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button
                            onClick={() => setIsBrandFormOpen(true)}
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
                            <GiQuill /> Log New Brand
                        </button>
                    </div>

                    {isBrandFormOpen && (
                        <div style={{
                            maxWidth: '600px',
                            margin: '0 auto 2rem',
                            background: 'var(--bg-panel)',
                            border: 'var(--border-double)',
                            padding: 'var(--space-xl)'
                        }}>
                            <h2 style={{ textAlign: 'center', color: 'var(--text-gold)', fontFamily: 'var(--font-display)', marginBottom: '2rem' }}>
                                New Brand
                            </h2>
                            <form onSubmit={handleBrandSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Brand Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newBrand.name}
                                        onChange={e => setNewBrand({ ...newBrand, name: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                        Website
                                        {newBrand.link && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!newBrand.link) return;
                                                    try {
                                                        const btn = document.activeElement;
                                                        const originalText = btn.innerText;
                                                        btn.innerText = '✨ Casting...';
                                                        btn.disabled = true;

                                                        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(newBrand.link)}`);
                                                        const data = await response.json();

                                                        if (data.status === 'success') {
                                                            const { title, image, description, publisher } = data.data;

                                                            // Update state with found data
                                                            setNewBrand(prev => ({
                                                                ...prev,
                                                                name: prev.name || publisher || title || '',
                                                                image_url: prev.image_url || (image?.url) || '',
                                                                notes: prev.notes || description || ''
                                                            }));
                                                        }
                                                        btn.innerText = originalText;
                                                        btn.disabled = false;
                                                    } catch (e) {
                                                        console.error(e);
                                                        alert('Could not magically fetch details.');
                                                        document.activeElement.innerText = '✨ Auto-Fill';
                                                        document.activeElement.disabled = false;
                                                    }
                                                }}
                                                style={{
                                                    marginLeft: '8px',
                                                    background: 'none',
                                                    border: '1px solid var(--accent-gold)',
                                                    color: 'var(--text-gold)',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.7rem',
                                                    padding: '2px 6px'
                                                }}
                                            >
                                                ✨ Auto-Fill
                                            </button>
                                        )}
                                    </label>
                                    <input
                                        type="url"
                                        value={newBrand.link}
                                        onChange={e => setNewBrand({ ...newBrand, link: e.target.value })}
                                        placeholder="https://..."
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Image URL</label>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <input
                                            type="url"
                                            value={newBrand.image_url || ''}
                                            onChange={e => setNewBrand({ ...newBrand, image_url: e.target.value })}
                                            placeholder="https://image-link.com/pic.jpg"
                                            style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                        />
                                        {newBrand.image_url && (
                                            <div style={{ width: '50px', height: '50px', border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                                                <img src={newBrand.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Tags (comma separated)</label>
                                    <input
                                        type="text"
                                        value={newBrand.tags}
                                        onChange={e => setNewBrand({ ...newBrand, tags: e.target.value })}
                                        placeholder="Basics, Denim, Office Wear"
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Notes</label>
                                    <textarea
                                        value={newBrand.notes}
                                        onChange={e => setNewBrand({ ...newBrand, notes: e.target.value })}
                                        placeholder="Good for quality linens..."
                                        rows="3"
                                        style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)', fontFamily: 'inherit' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsBrandFormOpen(false)}
                                        style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{ flex: 1, padding: '1rem', background: 'var(--accent-crimson)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        Save Brand
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {!isBrandFormOpen && (
                        <>
                            {/* Brand Controls */}
                            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                                    <GiMagnifyingGlass style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search brands..."
                                        value={brandSearch}
                                        onChange={(e) => setBrandSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem 0.6rem 0.6rem 2.2rem',
                                            background: 'rgba(0,0,0,0.2)',
                                            border: '1px solid var(--border-dim)',
                                            borderRadius: '4px',
                                            color: 'var(--text-main)',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <select
                                    value={brandFilterTag}
                                    onChange={(e) => setBrandFilterTag(e.target.value)}
                                    style={{
                                        padding: '0.6rem',
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid var(--border-dim)',
                                        borderRadius: '4px',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="">All Tags</option>
                                    {uniqueBrandTags.map(tag => (
                                        <option key={tag} value={tag}>{tag}</option>
                                    ))}
                                </select>
                                <select
                                    value={brandSort}
                                    onChange={(e) => setBrandSort(e.target.value)}
                                    style={{
                                        padding: '0.6rem',
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid var(--border-dim)',
                                        borderRadius: '4px',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="name-asc">Name (A-Z)</option>
                                    <option value="name-desc">Name (Z-A)</option>
                                    <option value="newest">Newest Added</option>
                                    <option value="oldest">Oldest Added</option>
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                {filteredBrands.map(brand => (
                                    <div key={brand.id} style={{
                                        background: 'var(--bg-panel)',
                                        border: '1px solid var(--border-dim)',
                                        padding: '1.5rem',
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.8rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                {brand.image_url && (
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-dim)', flexShrink: 0 }}>
                                                        <img src={brand.image_url} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                )}
                                                <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-gold)', borderBottom: '1px dotted var(--border-dim)', paddingBottom: '5px' }}>
                                                    {brand.name}
                                                </h3>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteBrand(brand.id)}
                                                style={{
                                                    color: deletingBrandId === brand.id ? 'var(--accent-crimson)' : 'var(--text-muted)',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    minWidth: '30px'
                                                }}
                                                title="Remove Brand"
                                            >
                                                {deletingBrandId === brand.id ? (
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Sure?</span>
                                                ) : (
                                                    <GiTrashCan />
                                                )}
                                            </button>
                                        </div>

                                        {brand.link && (
                                            <a href={brand.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'underline', fontStyle: 'italic', marginLeft: brand.image_url ? '56px' : '0' }}>
                                                Visit Website ↗
                                            </a>
                                        )}

                                        {brand.tags && brand.tags.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginLeft: brand.image_url ? '56px' : '0' }}>
                                                {brand.tags.map((tag, idx) => (
                                                    <span key={idx} style={{
                                                        fontSize: '0.75rem',
                                                        padding: '2px 8px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid var(--border-dim)',
                                                        borderRadius: '10px',
                                                        color: 'var(--text-main)'
                                                    }}>
                                                        <GiPriceTag style={{ fontSize: '0.6rem', marginRight: '4px', verticalAlign: 'middle' }} />
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {brand.notes && (
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4', marginLeft: brand.image_url ? '56px' : '0' }}>
                                                {brand.notes}
                                            </p>
                                        )}
                                    </div>
                                ))}

                                {brands.length === 0 && (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--border-dim)' }}>
                                        <GiShop style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }} />
                                        <p>The Brand Registry is empty.<br />Catalog your favorite purveyors here.</p>
                                    </div>
                                )}

                                {brands.length > 0 && filteredBrands.length === 0 && (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--border-dim)' }}>
                                        <GiMagnifyingGlass style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }} />
                                        <p>No brands found matching your search.</p>
                                        <button
                                            onClick={() => { setBrandSearch(''); setBrandFilterTag(''); }}
                                            style={{ marginTop: '0.5rem', background: 'none', border: '1px solid var(--text-muted)', color: 'var(--text-main)', padding: '0.3rem 0.8rem', cursor: 'pointer', borderRadius: '4px' }}
                                        >
                                            Clear Filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default Treasury;
