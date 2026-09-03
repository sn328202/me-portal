import React, { useState, useMemo } from 'react';
import { useTreasury } from '../hooks/useTreasury';
import { supabase } from '../lib/supabase';
import {
    GiOpenTreasureChest,
    GiQuill,
    GiTrashCan,
    GiCheckMark,
    GiDiamonds,
    GiPriceTag,
    GiShop,
    GiCoins,
    GiMagnifyingGlass,
    GiTiedScroll,
    GiEyeTarget
} from 'react-icons/gi';
import {
    Button,
    Card,
    PageHeader,
    Tabs,
    TabPanel,
    Modal,
    Field,
    Tag,
    ConfirmButton,
    EmptyState
} from '../components/ui';
import '../styles/Treasury.css';

const CATEGORIES = ['Home', 'Kitchen', 'Closet', 'Books', 'Tech', 'Personal Care', 'Other'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const EMPTY_ITEM = {
    title: '',
    category: 'Home',
    price: '',
    link: '',
    image_url: '',
    description: '',
    brand: '',
    priority: 'Medium'
};

const EMPTY_BRAND = {
    name: '',
    link: '',
    tags: '', // comma separated string for input
    notes: '',
    image_url: ''
};

const SECTIONS = [
    { id: 'desires', label: 'Desires', icon: <GiDiamonds /> },
    { id: 'brands', label: 'Brands', icon: <GiShop /> }
];

const VIEWS = [
    { id: 'ledger', label: 'Ledger', icon: <GiTiedScroll /> },
    { id: 'vision', label: 'Vision Board', icon: <GiEyeTarget /> }
];

const Treasury = () => {
    const { items, brands, loading, error, addItem, updateItem, deleteItem, addBrand, deleteBrand } = useTreasury();
    const [viewMode, setViewMode] = useState('ledger'); // 'ledger' or 'vision'
    const [activeTab, setActiveTab] = useState('desires'); // 'desires' or 'brands'

    // Desires Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [newItem, setNewItem] = useState(EMPTY_ITEM);
    const [castingItem, setCastingItem] = useState(false);

    // Brands Form State
    const [isBrandFormOpen, setIsBrandFormOpen] = useState(false);
    const [newBrand, setNewBrand] = useState(EMPTY_BRAND);
    const [castingBrand, setCastingBrand] = useState(false);

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

    // --- Handlers for Desires ---
    const openNewDesire = () => {
        setEditingItem(null);
        setNewItem(EMPTY_ITEM);
        setIsFormOpen(true);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setNewItem({ ...item }); // Pre-fill form
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingItem(null);
        setCastingItem(false);
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
            setNewItem(EMPTY_ITEM);
        } catch {
            alert('Error saving item');
        }
    };

    const toggleStatus = async (item) => {
        const newStatus = item.status === 'acquired' ? 'desired' : 'acquired';
        await updateItem({ ...item, status: newStatus });
    };

    /**
     * Read the product page. Themed as a spell: ✨ Auto-Fill -> ✨ Casting...
     *
     * This used to call api.microlink.io directly from the browser, which
     * returns title/image/description only — the price was then guessed by
     * running a regex over the description, which almost never found one — on a
     * free tier of about fifty requests a day. /api/link-preview reads the
     * shop's own schema.org Product data instead, so the price is the real one.
     */
    const readLink = async (url) => {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/link-preview', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${session?.access_token || ''}`,
            },
            body: JSON.stringify({ url }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'the page could not be read');
        }
        return data.product;
    };

    const castItemSpell = async () => {
        if (!newItem.link) return;
        setCastingItem(true);
        try {
            const p = await readLink(newItem.link);
            // Never overwrite something she has already typed.
            setNewItem(prev => ({
                ...prev,
                title: prev.title || p.title || '',
                image_url: prev.image_url || p.image_url || '',
                price: prev.price || (p.price_amount !== null ? String(p.price_amount) : ''),
                price_currency: p.price_currency || prev.price_currency,
                description: prev.description || p.description || '',
                brand: prev.brand || p.brand || '',
            }));
        } catch (e) {
            console.error(e);
            alert(`Could not read that page — ${e.message}. You may need to enter the details manually.`);
        } finally {
            setCastingItem(false);
        }
    };

    // --- Handlers for Brands ---
    const handleBrandSubmit = async (e) => {
        e.preventDefault();
        try {
            const tagsArray = newBrand.tags.split(',').map(t => t.trim()).filter(t => t);
            await addBrand({ ...newBrand, tags: tagsArray });
            setIsBrandFormOpen(false);
            setNewBrand(EMPTY_BRAND);
        } catch {
            alert('Error saving brand');
        }
    };

    const castBrandSpell = async () => {
        if (!newBrand.link) return;
        setCastingBrand(true);
        try {
            const p = await readLink(newBrand.link);
            setNewBrand(prev => ({
                ...prev,
                name: prev.name || p.brand || p.title || '',
                image_url: prev.image_url || p.image_url || '',
                notes: prev.notes || p.description || ''
            }));
        } catch (e) {
            console.error(e);
            alert(`Could not read that page — ${e.message}.`);
        } finally {
            setCastingBrand(false);
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
        return CATEGORIES.reduce((acc, cat) => {
            const catItems = items.filter(i => i.category === cat);
            const totalCost = catItems.reduce((sum, item) => sum + parsePrice(item.price), 0);
            acc[cat] = { items: catItems, total: totalCost };
            return acc;
        }, {});
    }, [items]);

    const visionItems = useMemo(() => items.filter(i => i.image_url), [items]);

    if (loading) return <div className="treasury-loading">Loading ledger...</div>;

    const createAction = activeTab === 'desires' ? (
        <Button variant="primary" onClick={openNewDesire}>
            <GiQuill /> Log New Desire
        </Button>
    ) : (
        <Button variant="primary" onClick={() => setIsBrandFormOpen(true)}>
            <GiQuill /> Log New Brand
        </Button>
    );

    return (
        <div className="page treasury-page">
            <PageHeader
                title="The Treasury"
                icon={<GiOpenTreasureChest />}
                subtitle="A ledger of wants. Nothing you ever wanted is erased."
                actions={createAction}
            />

            <Tabs
                tabs={SECTIONS}
                active={activeTab}
                onChange={setActiveTab}
                label="Treasury sections"
            />

            {error && <p className="muted">{error}</p>}

            {/* --- DESIRES TAB --- */}
            <TabPanel id="desires" active={activeTab}>
                <div className="stack">
                    <div className="treasury-toolbar">
                        <Tabs
                            variant="segmented"
                            tabs={VIEWS}
                            active={viewMode}
                            onChange={setViewMode}
                            label="Desire view"
                        />
                    </div>

                    {/* VISION BOARD MODE */}
                    {viewMode === 'vision' && (
                        visionItems.length === 0 ? (
                            <EmptyState
                                icon={<GiDiamonds />}
                                message="Nothing has been pictured yet."
                                hint="Add an Image URL to a desire and it will hang here."
                                actionLabel="Log New Desire"
                                onAction={openNewDesire}
                            />
                        ) : (
                            <div className="vision-board">
                                {visionItems.map(item => (
                                    <div key={item.id} className="vision-tile">
                                        {item.link ? (
                                            <a href={item.link} target="_blank" rel="noopener noreferrer">
                                                <img src={item.image_url} alt={item.title} />
                                                <div className="vision-caption">
                                                    {item.title}
                                                    <span className="vision-caption__mark" aria-hidden="true">↗</span>
                                                </div>
                                            </a>
                                        ) : (
                                            <>
                                                <img src={item.image_url} alt={item.title} />
                                                <div className="vision-caption">{item.title}</div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {/* LEDGER MODE */}
                    {viewMode === 'ledger' && (
                        items.length === 0 ? (
                            <EmptyState
                                icon={<GiOpenTreasureChest />}
                                message="The ledger is blank."
                                hint="Nothing is wanted yet. That is allowed."
                                actionLabel="Log New Desire"
                                onAction={openNewDesire}
                            />
                        ) : (
                            <div className="ledger-grid">
                                {CATEGORIES.map(cat => {
                                    const { items: catItems, total } = groupedData[cat] || { items: [], total: 0 };
                                    if (catItems.length === 0) return null;

                                    return (
                                        <Card
                                            key={cat}
                                            title={cat}
                                            actions={
                                                <span className="ledger-subtotal">
                                                    <GiCoins className="ledger-subtotal__icon" aria-hidden="true" />
                                                    <span className="ledger-subtotal__value">${total.toFixed(2)}</span>
                                                    <span className="ledger-subtotal__label">est.</span>
                                                </span>
                                            }
                                        >
                                            <ul className="desire-list">
                                                {catItems.map(item => (
                                                    <li
                                                        key={item.id}
                                                        className={item.status === 'acquired' ? 'desire desire--acquired' : 'desire'}
                                                    >
                                                        {item.image_url && (
                                                            <div className="thumb">
                                                                <img src={item.image_url} alt="" />
                                                            </div>
                                                        )}

                                                        <div className="desire__main">
                                                            <div className="desire__title">{item.title}</div>
                                                            <div className="desire__meta">
                                                                {item.price && <span>Approx. {item.price}</span>}
                                                                <Tag tone={item.priority === 'High' ? 'red' : 'default'}>
                                                                    {item.priority} Priority
                                                                </Tag>
                                                            </div>
                                                            {item.link && (
                                                                <a
                                                                    className="desire__link"
                                                                    href={item.link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    View Item
                                                                </a>
                                                            )}
                                                        </div>

                                                        <div className="desire__actions">
                                                            <Button
                                                                icon
                                                                size="sm"
                                                                className={item.status === 'acquired' ? 'is-marked' : ''}
                                                                label={item.status === 'acquired'
                                                                    ? `Mark ${item.title} as desired`
                                                                    : `Mark ${item.title} as acquired`}
                                                                onClick={() => toggleStatus(item)}
                                                            >
                                                                <GiCheckMark />
                                                            </Button>
                                                            <Button
                                                                icon
                                                                size="sm"
                                                                label={`Edit ${item.title}`}
                                                                onClick={() => handleEdit(item)}
                                                            >
                                                                <GiQuill />
                                                            </Button>
                                                            <ConfirmButton
                                                                label={`Discard ${item.title}`}
                                                                confirmLabel="Discard this desire?"
                                                                icon={<GiTrashCan />}
                                                                onConfirm={() => deleteItem(item.id)}
                                                            />
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </Card>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>
            </TabPanel>

            {/* --- BRANDS TAB --- */}
            <TabPanel id="brands" active={activeTab}>
                <div className="stack">
                    <div className="brand-controls">
                        <Field
                            label="Search"
                            type="text"
                            placeholder="Search brands..."
                            value={brandSearch}
                            onChange={(e) => setBrandSearch(e.target.value)}
                        />
                        <Field label="Tag">
                            <select
                                className="select"
                                value={brandFilterTag}
                                onChange={(e) => setBrandFilterTag(e.target.value)}
                            >
                                <option value="">All Tags</option>
                                {uniqueBrandTags.map(tag => (
                                    <option key={tag} value={tag}>{tag}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Sort">
                            <select
                                className="select"
                                value={brandSort}
                                onChange={(e) => setBrandSort(e.target.value)}
                            >
                                <option value="name-asc">Name (A-Z)</option>
                                <option value="name-desc">Name (Z-A)</option>
                                <option value="newest">Newest Added</option>
                                <option value="oldest">Oldest Added</option>
                            </select>
                        </Field>
                    </div>

                    {brands.length === 0 && (
                        <EmptyState
                            icon={<GiShop />}
                            message="The Brand Registry is empty."
                            hint="Catalog your favorite purveyors here."
                            actionLabel="Log New Brand"
                            onAction={() => setIsBrandFormOpen(true)}
                        />
                    )}

                    {brands.length > 0 && filteredBrands.length === 0 && (
                        <EmptyState
                            icon={<GiMagnifyingGlass />}
                            message="No brands found matching your search."
                            actionLabel="Clear Filters"
                            onAction={() => { setBrandSearch(''); setBrandFilterTag(''); }}
                        />
                    )}

                    {filteredBrands.length > 0 && (
                        <div className="brand-grid">
                            {filteredBrands.map(brand => (
                                <Card key={brand.id} variant="flat">
                                    <div className="row">
                                        <div className="brand-card__head">
                                            {brand.image_url && (
                                                <div className="thumb thumb--round">
                                                    <img src={brand.image_url} alt="" />
                                                </div>
                                            )}
                                            <h3 className="brand-card__name">{brand.name}</h3>
                                        </div>
                                        <span className="spacer" />
                                        <ConfirmButton
                                            label={`Remove ${brand.name}`}
                                            confirmLabel="Sure?"
                                            icon={<GiTrashCan />}
                                            onConfirm={() => deleteBrand(brand.id)}
                                        />
                                    </div>

                                    {brand.link && (
                                        <a
                                            className="brand-card__link"
                                            href={brand.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Visit Website ↗
                                        </a>
                                    )}

                                    {brand.tags && brand.tags.length > 0 && (
                                        <div className="tag-list">
                                            {brand.tags.map((tag, idx) => (
                                                <Tag key={idx} icon={<GiPriceTag />}>{tag}</Tag>
                                            ))}
                                        </div>
                                    )}

                                    {brand.notes && <p className="brand-card__notes">{brand.notes}</p>}
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </TabPanel>

            {/* --- DESIRE FORM --- */}
            <Modal
                open={isFormOpen}
                onClose={closeForm}
                title={editingItem ? 'Edit Entry' : 'New Entry'}
                footer={
                    <>
                        <Button onClick={closeForm}>Cancel</Button>
                        <Button variant="solid" type="submit" form="desire-form">Save Entry</Button>
                    </>
                }
            >
                <form id="desire-form" className="stack" onSubmit={handleSubmit}>
                    <Field
                        label="Item Name"
                        type="text"
                        required
                        value={newItem.title}
                        onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                    />

                    <div className="field-row">
                        <Field label="Category">
                            <select
                                className="select"
                                value={newItem.category}
                                onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </Field>
                        <Field label="Priority">
                            <select
                                className="select"
                                value={newItem.priority}
                                onChange={e => setNewItem({ ...newItem, priority: e.target.value })}
                            >
                                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </Field>
                    </div>

                    <div className="field-row">
                        <Field
                            label="Price (Est.)"
                            type="text"
                            placeholder="$20"
                            value={newItem.price}
                            onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                        />
                        <Field
                            label="Brand"
                            type="text"
                            placeholder="Filled in from the link"
                            value={newItem.brand || ''}
                            onChange={e => setNewItem({ ...newItem, brand: e.target.value })}
                        />
                    </div>

                    <Field label="Description">
                        <textarea
                            className="input"
                            rows={3}
                            placeholder="Filled in from the link"
                            value={newItem.description || ''}
                            onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                        />
                    </Field>

                    <div className="field-with-action">
                        <Field
                            label="Link"
                            type="url"
                            placeholder="https://..."
                            value={newItem.link}
                            onChange={e => setNewItem({ ...newItem, link: e.target.value })}
                        />
                        {newItem.link && (
                            <Button size="sm" disabled={castingItem} onClick={castItemSpell}>
                                {castingItem ? '✨ Casting...' : '✨ Auto-Fill'}
                            </Button>
                        )}
                    </div>

                    <div className="field-with-image">
                        <Field
                            label="Image URL"
                            type="url"
                            placeholder="https://image-link.com/pic.jpg"
                            value={newItem.image_url || ''}
                            onChange={e => setNewItem({ ...newItem, image_url: e.target.value })}
                        />
                        {newItem.image_url && (
                            <div className="thumb thumb--preview">
                                <img src={newItem.image_url} alt="Preview" />
                            </div>
                        )}
                    </div>
                </form>
            </Modal>

            {/* --- BRAND FORM --- */}
            <Modal
                open={isBrandFormOpen}
                onClose={() => setIsBrandFormOpen(false)}
                title="New Brand"
                footer={
                    <>
                        <Button onClick={() => setIsBrandFormOpen(false)}>Cancel</Button>
                        <Button variant="solid" type="submit" form="brand-form">Save Brand</Button>
                    </>
                }
            >
                <form id="brand-form" className="stack" onSubmit={handleBrandSubmit}>
                    <Field
                        label="Brand Name"
                        type="text"
                        required
                        value={newBrand.name}
                        onChange={e => setNewBrand({ ...newBrand, name: e.target.value })}
                    />

                    <div className="field-with-action">
                        <Field
                            label="Website"
                            type="url"
                            placeholder="https://..."
                            value={newBrand.link}
                            onChange={e => setNewBrand({ ...newBrand, link: e.target.value })}
                        />
                        {newBrand.link && (
                            <Button size="sm" disabled={castingBrand} onClick={castBrandSpell}>
                                {castingBrand ? '✨ Casting...' : '✨ Auto-Fill'}
                            </Button>
                        )}
                    </div>

                    <div className="field-with-image">
                        <Field
                            label="Image URL"
                            type="url"
                            placeholder="https://image-link.com/pic.jpg"
                            value={newBrand.image_url || ''}
                            onChange={e => setNewBrand({ ...newBrand, image_url: e.target.value })}
                        />
                        {newBrand.image_url && (
                            <div className="thumb thumb--preview">
                                <img src={newBrand.image_url} alt="Preview" />
                            </div>
                        )}
                    </div>

                    <Field
                        label="Tags"
                        hint="Comma separated."
                        type="text"
                        placeholder="Basics, Denim, Office Wear"
                        value={newBrand.tags}
                        onChange={e => setNewBrand({ ...newBrand, tags: e.target.value })}
                    />

                    <Field
                        label="Notes"
                        as="textarea"
                        rows="3"
                        placeholder="Good for quality linens..."
                        value={newBrand.notes}
                        onChange={e => setNewBrand({ ...newBrand, notes: e.target.value })}
                    />
                </form>
            </Modal>
        </div>
    );
};

export default Treasury;
