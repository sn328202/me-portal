import React, { useState, useMemo } from 'react';
import { useTreasury } from '../hooks/useTreasury';
import { GiOpenTreasureChest, GiQuill, GiTrashCan, GiCheckMark, GiDiamonds, GiExpand, GiCoins } from 'react-icons/gi';

const Treasury = () => {
    const { items, loading, error, addItem, updateItem, deleteItem } = useTreasury();
    const [viewMode, setViewMode] = useState('ledger'); // 'ledger' or 'vision'
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

    const categories = ['Home', 'Kitchen', 'Closet', 'Books', 'Tech', 'Personal Care', 'Other'];
    const priorities = ['High', 'Medium', 'Low'];

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

                <div style={{ display: 'flex', gap: '1rem' }}>
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
        </div>
    );
};

export default Treasury;
