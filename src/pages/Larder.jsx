import React, { useState, useMemo } from 'react';
import { useRecipes } from '../hooks/useRecipes';
import { useIngredients } from '../hooks/useIngredients';
import RecipeList from '../components/RecipeList';
import RecipeForm from '../components/RecipeForm';
import RecipeDetail from '../components/RecipeDetail';
import CookMode from '../components/CookMode';
import MealPlanner from '../components/MealPlanner';
import GroceryList from '../components/GroceryList';
import ProvisionsWidget from '../widgets/ProvisionsWidget';
import DaySelector from '../components/DaySelector';
import { GiQuill, GiMagnifyingGlass, GiFunnel, GiHourglass, GiTrashCan } from 'react-icons/gi';
import EmojiPicker from 'emoji-picker-react';

const PantryItem = ({ item, pantryStock, togglePantryStock, deleteIngredient }) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const inStock = pantryStock[item.id];

    return (
        <div
            style={{
                background: inStock ? 'rgba(207, 181, 59, 0.1)' : 'rgba(255,255,255,0.02)',
                border: inStock ? '1px solid var(--accent-gold)' : '1px solid var(--border-dim)',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                opacity: inStock ? 1 : 0.8,
                transition: 'all 0.2s',
                position: 'relative'
            }}
        >
            {/* Card Body - Click to Toggle Stock */}
            <div
                onClick={() => togglePantryStock(item.id)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
            >
                <span style={{ fontSize: '2rem' }}>{item.icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: inStock ? 'var(--text-gold)' : 'var(--text-muted)', fontWeight: inStock ? 'bold' : 'normal' }}>
                        {item.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {inStock ? 'IN STOCK' : 'OUT'}
                    </span>
                </div>
            </div>

            {/* Delete Button (For All) */}
            {confirmDelete ? (
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteIngredient(item.id);
                        }}
                        style={{ background: 'var(--accent-crimson)', border: 'none', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer', borderRadius: '2px' }}
                    >
                        CONFIRM
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(false);
                        }}
                        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-dim)', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer', borderRadius: '2px' }}
                    >
                        X
                    </button>
                </div>
            ) : (
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent toggling stock
                        setConfirmDelete(true);
                    }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-crimson)',
                        cursor: 'pointer',
                        opacity: 0.5,
                        padding: '4px'
                    }}
                    title="Remove Provision"
                >
                    <GiTrashCan />
                </button>
            )}
        </div>
    );
};

const Larder = () => {
    const [activeTab, setActiveTab] = useState('collection'); // 'collection', 'hearth', 'provisions'
    const [view, setView] = useState('list'); // 'list', 'form', 'detail', 'cook'
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [viewingRecipe, setViewingRecipe] = useState(null);
    const [isDaySelectorOpen, setIsDaySelectorOpen] = useState(false);
    const [selectedRecipeForPlan, setSelectedRecipeForPlan] = useState(null);

    // Filter & Sort State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTag, setFilterTag] = useState('');
    const [sortBy, setSortBy] = useState('newest'); // 'newest', 'title'

    const { recipes, loading, error, addRecipe, deleteRecipe, updateRecipe, mealPlan, addToPlan, clearDay, importRecipe } = useRecipes();
    const { ingredientsByCategory, pantryStock, togglePantryStock, addCustomIngredient, deleteIngredient, ingredientsByName } = useIngredients();

    const [newIngIcon, setNewIngIcon] = useState('🍽️');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Pantry Filter & Sort State
    const [pantrySearch, setPantrySearch] = useState('');
    const [pantryFilter, setPantryFilter] = useState(''); // Category
    const [pantrySort, setPantrySort] = useState('category'); // 'category', 'name', 'stocked'

    // Derived Logic
    const allTags = useMemo(() => {
        const tags = new Set();
        recipes.forEach(r => r.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [recipes]);

    // Helper: Calculate Pantry Match
    const calculatePantryMatch = (recipe) => {
        if (!recipe.ingredients || recipe.ingredients.length === 0) return { percentage: 0, missing: [], total: 0 };

        let matchCount = 0;
        const missing = [];

        recipe.ingredients.forEach(ing => {
            // Logic: Check by ID (if available) OR Name
            // Ideally ingredients in recipes should be linked to pantry IDs for precision,
            // but for now we often rely on strings.
            const name = (ing.item || ing.name || '').toLowerCase().trim();
            const ingObj = ingredientsByName[name];

            // If we have a pantry object and it is in stock -> Match
            // OR if we just search the pantryStock keys (if we knew IDs) - but here recipes might just have text.
            // Let's assume recipes might not have IDs yet, so we use the name map.

            let isStocked = false;
            if (ingObj && pantryStock[ingObj.id]) {
                isStocked = true;
            }

            if (isStocked) {
                matchCount++;
            } else {
                missing.push(ing);
            }
        });

        const total = recipe.ingredients.length;
        const percentage = total === 0 ? 0 : Math.round((matchCount / total) * 100);
        return { percentage, missing, total };
    };

    const filteredRecipes = useMemo(() => {
        // First map all to include match data
        let result = recipes.map(r => ({
            ...r,
            ...calculatePantryMatch(r) // adds percentage, missing, total
        }));

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.title.toLowerCase().includes(q) ||
                r.ingredients.some(i => i.item.toLowerCase().includes(q))
            );
        }

        // Filter
        if (filterTag) {
            result = result.filter(r => r.tags?.includes(filterTag));
        }

        // Sort
        if (sortBy === 'title') {
            result.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortBy === 'newest') {
            result.sort((a, b) => {
                if (typeof b.id === 'string' && typeof a.id === 'string') {
                    return (b.created_at || '').localeCompare(a.created_at || '');
                }
                return b.id - a.id;
            });
        } else if (sortBy === 'match') {
            // Sort by percentage DESC, then by title
            result.sort((a, b) => {
                if (b.percentage !== a.percentage) return b.percentage - a.percentage;
                return a.title.localeCompare(b.title);
            });
        }

        return result;
    }, [recipes, searchQuery, filterTag, sortBy, ingredientsByName, pantryStock]);

    // Derived Pantry List (Filtered & Sorted)
    const processedPantry = useMemo(() => {
        // 1. Flatten
        let allIngredients = [];
        Object.values(ingredientsByCategory).forEach(list => {
            allIngredients = [...allIngredients, ...list];
        });

        // 2. Search
        if (pantrySearch) {
            const q = pantrySearch.toLowerCase();
            allIngredients = allIngredients.filter(i => i.label.toLowerCase().includes(q));
        }

        // 3. Filter by Category
        if (pantryFilter) {
            allIngredients = allIngredients.filter(i => i.category === pantryFilter);
        }

        // 4. Sort
        if (pantrySort === 'name') {
            allIngredients.sort((a, b) => a.label.localeCompare(b.label));
        } else if (pantrySort === 'stocked') {
            allIngredients.sort((a, b) => {
                const stockA = pantryStock[a.id] ? 1 : 0;
                const stockB = pantryStock[b.id] ? 1 : 0;
                if (stockB !== stockA) return stockB - stockA; // Stocked first
                return a.label.localeCompare(b.label);
            });
        }
        // If sort is 'category', we typically defer to the grouped view, 
        // BUT if search is active, we might want a flat list sorted by category?
        // Let's stick to the plan: if 'category' AND no search, show Groups. 
        // If Search is active, show Flat list? Or allow Groups with Search?
        // Simplest: 
        // If sort === 'category' AND !pantrySearch, return null (signal to use grouped view).
        // Actually, let's return the list and handle view switching in render.

        if (pantrySort === 'category') {
            // Sort flat list by category just in case we render it flat
            allIngredients.sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
        }

        return allIngredients;
    }, [ingredientsByCategory, pantrySearch, pantryFilter, pantrySort, pantryStock]);

    const showFlatPantry = pantrySort !== 'category' || pantrySearch !== '';

    const handleEdit = (recipe) => {
        setEditingRecipe(recipe);
        setView('form');
    };

    const handleView = (recipe) => {
        setViewingRecipe(recipe);
        setView('detail');
    };

    const handleCook = () => {
        setView('cook');
    };

    const handleCreate = () => {
        setEditingRecipe(null);
        setView('form');
    };

    const handleSave = (recipe) => {
        // 1. Auto-Add Removed - User manually confirms in form now.


        // 2. Save Recipe
        // Check for ID to determine Update vs Create.
        // Importantly, imported recipes might be in 'editingRecipe' state but lack an ID.
        if (recipe.id) {
            updateRecipe(recipe);
        } else {
            addRecipe(recipe);
        }
        setView('list');
    };

    const handleCancel = () => {
        setView('list');
        setEditingRecipe(null);
    };

    const handleAddToPlan = (recipe) => {
        setSelectedRecipeForPlan(recipe);
        setIsDaySelectorOpen(true);
    };

    const handleDaySelect = (day) => {
        if (selectedRecipeForPlan) {
            addToPlan(day, selectedRecipeForPlan.id);
            // Optional: Success toast could go here
        }
        setIsDaySelectorOpen(false);
        setSelectedRecipeForPlan(null);
    };

    if (loading) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-gold)' }}>
                <GiHourglass size={48} className="spin-animation" />
                <p style={{ marginTop: 'var(--space-md)', fontFamily: 'var(--font-display)' }}>Consulting the archives...</p>
                <style>{`
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(180deg); } }
                    .spin-animation { animation: spin 2s infinite ease-in-out; }
                `}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--accent-crimson)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)' }}>The pantry is locked.</h3>
                <p>Error connecting to the archives: {error}</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Did you run the SQL setup script?</p>
            </div>
        );
    }

    return (
        <div className="larder-container" style={{ maxWidth: '1400px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h1 className="box-header" style={{
                    fontSize: '2rem',
                    margin: 0,
                    color: 'var(--text-main)',
                }}>
                    The Larder
                </h1>

                {activeTab === 'collection' && view === 'list' && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <button
                            onClick={handleCreate}
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
                                letterSpacing: '1px',
                                cursor: 'pointer'
                            }}>
                            <GiQuill /> New Formula
                        </button>

                    </div>
                )}
            </div>

            <div style={{ borderBottom: 'var(--border-double)', marginBottom: 'var(--space-lg)' }}></div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                {['collection', 'hearth', 'pantry', 'provisions'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            border: '1px solid var(--border-gold)',
                            background: activeTab === tab ? 'var(--accent-crimson)' : 'transparent',
                            color: activeTab === tab ? 'var(--text-main)' : 'var(--text-gold)',
                            fontFamily: 'var(--font-display)',
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            opacity: activeTab === tab ? 1 : 0.7
                        }}
                    >
                        {tab === 'collection' && 'Recipe Collection'}
                        {tab === 'hearth' && 'The Hearth'}
                        {tab === 'pantry' && 'Pantry'}
                        {tab === 'provisions' && 'Provisions'}
                    </button>
                ))}
            </div>

            {/* Collection Controls (Search/Filter) */}
            {
                activeTab === 'collection' && view === 'list' && (
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-md)',
                        marginBottom: 'var(--space-lg)',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        background: 'var(--bg-panel)',
                        padding: 'var(--space-sm)',
                        border: '1px solid var(--border-dim)'
                    }}>
                        {/* Search */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                            <GiMagnifyingGlass style={{ color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search formulas..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: '1px solid var(--border-dim)',
                                    color: 'var(--text-main)',
                                    fontFamily: 'var(--font-body)',
                                    width: '100%',
                                    padding: '4px',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Filter Tag */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <GiFunnel style={{ color: 'var(--text-muted)' }} />
                            <select
                                value={filterTag}
                                onChange={(e) => setFilterTag(e.target.value)}
                                style={{
                                    background: 'var(--bg-main)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-dim)',
                                    padding: '4px 8px',
                                    fontFamily: 'var(--font-mono)',
                                    outline: 'none'
                                }}
                            >
                                <option value="">All Tags</option>
                                {allTags.map(tag => (
                                    <option key={tag} value={tag}>{tag}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sort */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <GiHourglass style={{ color: 'var(--text-muted)' }} />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                style={{
                                    background: 'var(--bg-main)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-dim)',
                                    padding: '4px 8px',
                                    fontFamily: 'var(--font-mono)',
                                    outline: 'none'
                                }}
                            >
                                <option value="newest">Newest First</option>
                                <option value="title">Alphabetical</option>
                                <option value="match">% Pantry Match</option>
                            </select>
                        </div>
                    </div>
                )
            }

            {/* Content Area */}
            <div className="larder-content" style={{ flex: 1, overflowY: 'auto', paddingRight: 'var(--space-sm)' }}>
                {activeTab === 'collection' && (
                    <>
                        {view === 'list' ? (
                            <RecipeList
                                recipes={filteredRecipes}
                                onEdit={handleEdit}
                                onDelete={deleteRecipe}
                                onAddToPlan={handleAddToPlan}
                                onView={handleView}
                            />
                        ) : view === 'form' ? (
                            <RecipeForm
                                recipe={editingRecipe}
                                onSave={handleSave}
                                onCancel={handleCancel}
                                ingredientsByName={ingredientsByName}
                                onAddIngredientToPantry={addCustomIngredient}
                                onImport={importRecipe}
                            />
                        ) : view === 'detail' && viewingRecipe ? (
                            <RecipeDetail
                                recipe={viewingRecipe}
                                onClose={() => setView('list')}
                                onEdit={() => handleEdit(viewingRecipe)}
                                onCook={handleCook}
                                pantryStock={pantryStock}
                                ingredientsByName={ingredientsByName}
                            />
                        ) : view === 'cook' && viewingRecipe ? (
                            <CookMode
                                recipe={viewingRecipe}
                                onClose={() => setView('detail')}
                            />
                        ) : null}
                    </>
                )}
                {activeTab === 'pantry' && (
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                        {/* Quick Add Form */}
                        <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--bg-panel)', border: '1px solid var(--border-gold)', borderRadius: '4px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-gold)' }}>NEW PROVISION:</span>
                            <input id="newIngName" placeholder="Name (e.g. Saffron)" style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--text-muted)', color: 'var(--text-main)', padding: '4px' }} />
                            <select id="newIngCat" style={{ background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-dim)', padding: '4px' }}>
                                <option value="Pantry">Pantry</option>
                                <option value="Produce">Produce</option>
                                <option value="Dairy">Dairy</option>
                                <option value="Protein">Protein</option>
                                <option value="Spices">Spices</option>
                            </select>

                            {/* Emoji Picker */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    style={{
                                        width: '40px', height: '40px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-dim)',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                        fontSize: '1.5rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    {newIngIcon}
                                </button>
                                {showEmojiPicker && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100 }}>
                                        <EmojiPicker
                                            theme="dark"
                                            onEmojiClick={(emojiData) => {
                                                setNewIngIcon(emojiData.emoji);
                                                setShowEmojiPicker(false);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    const name = document.getElementById('newIngName').value;
                                    const cat = document.getElementById('newIngCat').value;

                                    if (name) {
                                        addCustomIngredient(name.toLowerCase(), {
                                            icon: newIngIcon, category: cat, label: name, defaultUnit: 'pcs'
                                        });
                                        document.getElementById('newIngName').value = '';
                                        setNewIngIcon('🍽️'); // Reset to default
                                    }
                                }}
                                style={{
                                    background: 'var(--accent-gold)', color: 'var(--bg-main)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 'bold'
                                }}
                            >
                                ADD TO PANTRY
                            </button>
                        </div>


                        {/* Pantry Controls */}
                        <div style={{
                            display: 'flex',
                            gap: 'var(--space-md)',
                            marginBottom: 'var(--space-lg)',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            background: 'var(--bg-panel)',
                            padding: 'var(--space-sm)',
                            border: '1px solid var(--border-dim)'
                        }}>
                            {/* Search */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                                <GiMagnifyingGlass style={{ color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search provisions..."
                                    value={pantrySearch}
                                    onChange={(e) => setPantrySearch(e.target.value)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid var(--border-dim)',
                                        color: 'var(--text-main)',
                                        fontFamily: 'var(--font-body)',
                                        width: '100%',
                                        padding: '4px',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Filter Category */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <GiFunnel style={{ color: 'var(--text-muted)' }} />
                                <select
                                    value={pantryFilter}
                                    onChange={(e) => setPantryFilter(e.target.value)}
                                    style={{
                                        background: 'var(--bg-main)',
                                        color: 'var(--text-main)',
                                        border: '1px solid var(--border-dim)',
                                        padding: '4px 8px',
                                        fontFamily: 'var(--font-mono)',
                                        outline: 'none'
                                    }}
                                >
                                    <option value="">All Categories</option>
                                    {Object.keys(ingredientsByCategory).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Sort */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <GiHourglass style={{ color: 'var(--text-muted)' }} />
                                <select
                                    value={pantrySort}
                                    onChange={(e) => setPantrySort(e.target.value)}
                                    style={{
                                        background: 'var(--bg-main)',
                                        color: 'var(--text-main)',
                                        border: '1px solid var(--border-dim)',
                                        padding: '4px 8px',
                                        fontFamily: 'var(--font-mono)',
                                        outline: 'none'
                                    }}
                                >
                                    <option value="category">Category (Groups)</option>
                                    <option value="name">Name (A-Z)</option>
                                    <option value="stocked">In Stock First</option>
                                </select>
                            </div>
                        </div>

                        {/* Render Pantry List */}
                        {showFlatPantry ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                                {processedPantry.map(item => (
                                    <PantryItem
                                        key={item.id}
                                        item={item}
                                        pantryStock={pantryStock}
                                        togglePantryStock={togglePantryStock}
                                        deleteIngredient={deleteIngredient}
                                    />
                                ))}
                                {processedPantry.length === 0 && (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', gridColumn: '1/-1' }}>
                                        No provisions match your criteria.
                                    </div>
                                )}
                            </div>
                        ) : (
                            Object.entries(ingredientsByCategory).map(([category, items]) => {
                                // If filtering by category, only show that category (redundant if using flat view for filter, but good backup)
                                if (pantryFilter && category !== pantryFilter) return null;

                                return (
                                    <div key={category} style={{ marginBottom: '2rem' }}>
                                        <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-gold)', borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                                            {category}
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                                            {items.map(item => (
                                                <PantryItem
                                                    key={item.id}
                                                    item={item}
                                                    pantryStock={pantryStock}
                                                    togglePantryStock={togglePantryStock}
                                                    deleteIngredient={deleteIngredient}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
                {activeTab === 'hearth' && (
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                        <div style={{ marginBottom: 'var(--space-md)', color: 'var(--text-muted)' }}>
                            Select recipes from the Collection to check your stock. Arrange your sustenance here.
                        </div>
                        <MealPlanner
                            plan={mealPlan}
                            recipes={recipes}
                            onClearDay={clearDay}
                        />
                    </div>
                )}
                {activeTab === 'provisions' && (
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <GroceryList plan={mealPlan} recipes={recipes} />
                    </div>
                )}
            </div>

            <DaySelector
                isOpen={isDaySelectorOpen}
                onClose={() => setIsDaySelectorOpen(false)}
                onSelect={handleDaySelect}
            />
        </div >
    );
};

export default Larder;
