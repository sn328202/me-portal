import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useRecipes } from '../hooks/useRecipes';
import { useIngredients } from '../hooks/useIngredients';
import RecipeList from '../components/RecipeList';
import RecipeForm from '../components/RecipeForm';
import RecipeDetail from '../components/RecipeDetail';
import CookMode from '../components/CookMode';
import MealPlanner from '../components/MealPlanner';
import GroceryList from '../components/GroceryList';
import DaySelector from '../components/DaySelector';
import MenuBuilder from '../components/MenuBuilder';
import { useMenus } from '../hooks/useMenus';
import {
    GiQuill, GiMagnifyingGlass, GiFunnel, GiHourglass, GiCookingPot,
    GiHerbsBundle, GiBasket, GiScrollQuill, GiScrollUnfurled, GiCauldron, GiTrashCan
} from 'react-icons/gi';
import EmojiPicker from 'emoji-picker-react';
import { readToken, isLight } from '../utils/mapStyle';
import {
    Button, Card, ConfirmButton, EmptyState, Field, Modal, PageHeader, Tabs, TabPanel, Tag
} from '../components/ui';
import '../styles/Larder.css';

const TABS = [
    { id: 'collection', label: 'Recipe Collection' },
    { id: 'hearth', label: 'The Hearth' },
    { id: 'menus', label: 'Menu Builder' },
    { id: 'pantry', label: 'Pantry' },
    { id: 'provisions', label: 'Provisions' }
];

const TAB_SUBTITLES = {
    hearth: 'Select recipes from the Collection to check your stock. Arrange your sustenance here.',
    menus: 'Curate your grandest menus for the most exceptional occasions.'
};

const PROVISION_CATEGORIES = ['Pantry', 'Produce', 'Dairy', 'Protein', 'Spices'];

const RECIPE_SORTS = [
    { value: 'newest', label: 'Newest First' },
    { value: 'title', label: 'Alphabetical' },
    { value: 'match', label: '% Pantry Match' }
];

const PANTRY_SORTS = [
    { value: 'category', label: 'Category (Groups)' },
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'stocked', label: 'In Stock First' }
];

const EMPTY_PROVISION = { name: '', category: 'Pantry', icon: '🍽️' };

/**
 * One filter bar, used by both the Collection and the Pantry. These were two
 * byte-identical blocks with two different border treatments.
 */
const LarderFilters = ({
    search, onSearch, searchPlaceholder,
    filter, onFilter, filterLabel, filterAllLabel, filterOptions,
    sort, onSort, sortOptions
}) => (
    <div className="larder-filters">
        <Field
            label={<><GiMagnifyingGlass /> Search</>}
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
        />
        <Field label={<><GiFunnel /> {filterLabel}</>}>
            <select className="select" value={filter} onChange={(e) => onFilter(e.target.value)}>
                <option value="">{filterAllLabel}</option>
                {filterOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        </Field>
        <Field label={<><GiHourglass /> Sort</>}>
            <select className="select" value={sort} onChange={(e) => onSort(e.target.value)}>
                {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </Field>
    </div>
);

const PantryItem = ({
    item, pantryStock, togglePantryStock, deleteIngredient,
    removeAlias, addAlias, updateIngredient,
}) => {
    const inStock = !!pantryStock[item.id];
    const aliases = item.aliases || [];

    const [picking, setPicking] = useState(false);
    const [naming, setNaming] = useState(false);
    const [draft, setDraft] = useState('');

    const submitAlias = (e) => {
        e.preventDefault();
        const value = draft.trim();
        if (value) addAlias?.(item.id, value);
        setDraft('');
        setNaming(false);
    };

    return (
        <div className={['pantry-item', inStock ? 'pantry-item--stocked' : ''].filter(Boolean).join(' ')}>
            {/* The symbol is its own button, not part of the stock toggle -
                otherwise changing an emoji would also empty the cupboard. */}
            <button
                type="button"
                className="pantry-item__icon-btn"
                aria-expanded={picking}
                aria-label={`Change the symbol for ${item.label}`}
                onClick={() => setPicking((v) => !v)}
            >
                <span className="pantry-item__icon" aria-hidden="true">{item.icon}</span>
            </button>

            {picking && (
                <div className="pantry-item__picker">
                    <EmojiPicker
                        width={280}
                        height={340}
                        /* Read off the current skin rather than hardcoded. The
                           New Provision modal pins this to "dark", which is
                           wrong on Studio, Cottagecore and Retro. */
                        theme={isLight(readToken('--bg-panel', '#ffffff')) ? 'light' : 'dark'}
                        onEmojiClick={(emojiData) => {
                            updateIngredient?.(item.id, { icon: emojiData.emoji });
                            setPicking(false);
                        }}
                    />
                </div>
            )}

            <button
                type="button"
                className="pantry-item__toggle"
                aria-pressed={inStock}
                onClick={() => togglePantryStock(item.id)}
            >
                <span className="pantry-item__text">
                    <span className="pantry-item__label">{item.label}</span>
                    <Tag tone={inStock ? 'gold' : 'default'}>{inStock ? 'IN STOCK' : 'OUT'}</Tag>
                </span>
            </button>

            {/* The names this ingredient has been taught to answer to, and a way
                to add another. Shown here because an alias that cannot be seen
                cannot be corrected - and because a connection is often obvious
                long before a recipe happens to surface it. */}
            <ul className="pantry-item__aliases">
                {aliases.map((alias) => (
                    <li key={alias}>
                        <button
                            type="button"
                            className="pantry-item__alias"
                            title={`Stop matching "${alias}" to ${item.label}`}
                            onClick={() => removeAlias?.(item.id, alias)}
                        >
                            {alias} <span aria-hidden="true">×</span>
                            <span className="visually-hidden">remove this alias</span>
                        </button>
                    </li>
                ))}
                <li>
                    {naming ? (
                        <form onSubmit={submitAlias} className="pantry-item__alias-form">
                            <input
                                type="text"
                                autoFocus
                                className="pantry-item__alias-input"
                                placeholder="another name…"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={submitAlias}
                            />
                        </form>
                    ) : (
                        <button
                            type="button"
                            className="pantry-item__alias pantry-item__alias--add"
                            onClick={() => setNaming(true)}
                        >
                            + name
                        </button>
                    )}
                </li>
            </ul>

            <ConfirmButton
                label={`Remove ${item.label} from the larder`}
                confirmLabel="CONFIRM"
                icon={<GiTrashCan />}
                onConfirm={() => deleteIngredient(item.id)}
            />
        </div>
    );
};

const Larder = () => {
    const [activeTab, setActiveTab] = useState('collection'); // 'collection', 'hearth', 'menus', 'pantry', 'provisions'
    const [view, setView] = useState('list'); // 'list', 'form', 'detail', 'cook'
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [viewingRecipe, setViewingRecipe] = useState(null);
    const [isDaySelectorOpen, setIsDaySelectorOpen] = useState(false);
    const [selectedRecipeForPlan, setSelectedRecipeForPlan] = useState(null);

    // Filter & Sort State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTag, setFilterTag] = useState('');
    const [sortBy, setSortBy] = useState('newest'); // 'newest', 'title', 'match'

    const { recipes, loading, error, addRecipe, deleteRecipe, updateRecipe, mealPlan, addToPlan, clearDay, importRecipe } = useRecipes();
    const {
        ingredientsByCategory, pantryStock, togglePantryStock, addCustomIngredient,
        deleteIngredient, ingredientsByName, matcher, addManyIngredients, addAlias,
        removeAlias, ingredients, updateIngredient,
    } = useIngredients();
    const { menus, addMenu, updateMenu, deleteMenu } = useMenus();

    // The Hearth: which day a picked formula lands on
    const [picker, setPicker] = useState({ open: false, day: null });
    const [pickerQuery, setPickerQuery] = useState('');

    // Menu Builder: create/edit mode lives here so the page header owns the action
    const [isBuildingMenu, setIsBuildingMenu] = useState(false);

    // Pantry quick-add (controlled; no more document.getElementById)
    const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
    const [newProvision, setNewProvision] = useState(EMPTY_PROVISION);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Pantry Filter & Sort State
    const [pantrySearch, setPantrySearch] = useState('');
    const [pantryFilter, setPantryFilter] = useState(''); // Category
    const [pantrySort, setPantrySort] = useState('category'); // 'category', 'name', 'stocked'

    const groceryInputRef = useRef(null);

    // Derived Logic
    const allTags = useMemo(() => {
        const tags = new Set();
        recipes.forEach(r => r.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [recipes]);

    /**
     * Pantry match for the recipe list.
     *
     * This was a third hand-rolled copy of the same exact-string lookup that
     * RecipeDetail and ProvisionsWidget each had. All three now share one
     * matcher, so a recipe cannot report 20% here and 60% when opened.
     */
    const calculatePantryMatch = useCallback((recipe) => {
        const result = matcher.matchRecipe(recipe.ingredients || []);
        return {
            percentage: result.percent,
            // "Missing" in the list has always meant "not in the cupboard right
            // now", which includes things the pantry knows about but has run
            // out of - not only things it has never heard of.
            missing: result.lines.filter((l) => !l.inStock),
            unknown: result.missing,
            total: result.total,
        };
    }, [matcher]);

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
                (r.title || '').toLowerCase().includes(q) ||
                (r.ingredients || []).some(i => (i.item || '').toLowerCase().includes(q))
            );
        }

        // Filter
        if (filterTag) {
            result = result.filter(r => r.tags?.includes(filterTag));
        }

        // Sort
        if (sortBy === 'title') {
            result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
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
                return (a.title || '').localeCompare(b.title || '');
            });
        }

        return result;
    }, [recipes, searchQuery, filterTag, sortBy, calculatePantryMatch]);

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
            allIngredients = allIngredients.filter(i => (i.label || '').toLowerCase().includes(q));
        }

        // 3. Filter by Category
        if (pantryFilter) {
            allIngredients = allIngredients.filter(i => i.category === pantryFilter);
        }

        // 4. Sort
        if (pantrySort === 'name') {
            allIngredients.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
        } else if (pantrySort === 'stocked') {
            allIngredients.sort((a, b) => {
                const stockA = pantryStock[a.id] ? 1 : 0;
                const stockB = pantryStock[b.id] ? 1 : 0;
                if (stockB !== stockA) return stockB - stockA; // Stocked first
                return (a.label || '').localeCompare(b.label || '');
            });
        } else if (pantrySort === 'category') {
            // Sort flat list by category just in case we render it flat
            allIngredients.sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.label || '').localeCompare(b.label || ''));
        }

        return allIngredients;
    }, [ingredientsByCategory, pantrySearch, pantryFilter, pantrySort, pantryStock]);

    const showFlatPantry = pantrySort !== 'category' || pantrySearch !== '';

    const pickerResults = useMemo(() => {
        const q = pickerQuery.toLowerCase().trim();
        if (!q) return recipes.slice(0, 30);
        return recipes.filter(r => (r.title || '').toLowerCase().includes(q)).slice(0, 30);
    }, [recipes, pickerQuery]);

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
        }
        setIsDaySelectorOpen(false);
        setSelectedRecipeForPlan(null);
    };

    const openPicker = (day) => {
        setPickerQuery('');
        setPicker({ open: true, day });
    };

    const closePicker = () => setPicker({ open: false, day: null });

    const handlePickRecipe = (recipe) => {
        const { day } = picker;
        closePicker();
        if (day) {
            addToPlan(day, recipe.id);
        } else {
            // No day chosen yet — fall through to the day selector.
            setSelectedRecipeForPlan(recipe);
            setIsDaySelectorOpen(true);
        }
    };

    const closeProvisionModal = () => {
        setIsProvisionModalOpen(false);
        setShowEmojiPicker(false);
        setNewProvision(EMPTY_PROVISION);
    };

    const handleAddProvision = () => {
        const name = newProvision.name.trim();
        if (!name) return;
        addCustomIngredient(name.toLowerCase(), {
            icon: newProvision.icon,
            category: newProvision.category,
            label: name,
            defaultUnit: 'pcs'
        });
        closeProvisionModal();
    };

    if (loading) {
        return (
            <div className="larder-loading">
                <span className="spin"><GiHourglass size={48} /></span>
                <p>Consulting the archives...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="larder-error">
                <EmptyState
                    icon={<GiCauldron />}
                    message="The pantry is locked."
                    hint={<>Error connecting to the archives: {error}<br />Did you run the SQL setup script?</>}
                />
            </div>
        );
    }

    // Every tab gets its own primary action, named for that tab.
    const headerAction = (() => {
        if (activeTab === 'collection') {
            return view === 'list' ? (
                <Button variant="primary" onClick={handleCreate}>
                    <GiQuill /> New Formula
                </Button>
            ) : (
                <Button variant="ghost" onClick={handleCancel}>
                    <GiScrollUnfurled /> Back to the Archives
                </Button>
            );
        }
        if (activeTab === 'hearth') {
            return (
                <Button variant="primary" onClick={() => openPicker(null)}>
                    <GiCookingPot /> Plan a Meal
                </Button>
            );
        }
        if (activeTab === 'menus') {
            return isBuildingMenu ? null : (
                <Button variant="primary" onClick={() => setIsBuildingMenu(true)}>
                    <GiScrollQuill /> New Menu
                </Button>
            );
        }
        if (activeTab === 'pantry') {
            return (
                <Button variant="primary" onClick={() => setIsProvisionModalOpen(true)}>
                    <GiHerbsBundle /> New Provision
                </Button>
            );
        }
        return (
            <Button variant="primary" onClick={() => groceryInputRef.current?.focus()}>
                <GiBasket /> Scribble Item
            </Button>
        );
    })();

    return (
        <div className="page larder">
            <PageHeader
                title="The Larder"
                subtitle={TAB_SUBTITLES[activeTab]}
                actions={headerAction}
            />

            <Tabs
                tabs={TABS}
                active={activeTab}
                onChange={setActiveTab}
                label="The Larder"
            />

            <div className="larder__content">
                <TabPanel id="collection" active={activeTab}>
                    {view === 'list' ? (
                        <div className="stack">
                            <LarderFilters
                                search={searchQuery}
                                onSearch={setSearchQuery}
                                searchPlaceholder="Search formulas..."
                                filter={filterTag}
                                onFilter={setFilterTag}
                                filterLabel="Tag"
                                filterAllLabel="All Tags"
                                filterOptions={allTags}
                                sort={sortBy}
                                onSort={setSortBy}
                                sortOptions={RECIPE_SORTS}
                            />
                            <RecipeList
                                recipes={filteredRecipes}
                                matcher={matcher}
                                onEdit={handleEdit}
                                onDelete={deleteRecipe}
                                onAddToPlan={handleAddToPlan}
                                onView={handleView}
                                onCreate={handleCreate}
                            />
                        </div>
                    ) : view === 'form' ? (
                        <RecipeForm
                            recipe={editingRecipe}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            ingredientsByName={ingredientsByName}
                            matcher={matcher}
                            onAddIngredientToPantry={addCustomIngredient}
                            onImport={importRecipe}
                            allTags={allTags}
                        />
                    ) : view === 'detail' && viewingRecipe ? (
                        <RecipeDetail
                            recipe={viewingRecipe}
                            onClose={() => setView('list')}
                            onEdit={() => handleEdit(viewingRecipe)}
                            onCook={handleCook}
                            matcher={matcher}
                            ingredients={ingredients}
                            categories={PROVISION_CATEGORIES}
                            onAddMissing={addManyIngredients}
                            onTeachAlias={addAlias}
                        />
                    ) : view === 'cook' && viewingRecipe ? (
                        <CookMode
                            recipe={viewingRecipe}
                            onClose={() => setView('detail')}
                        />
                    ) : null}
                </TabPanel>

                <TabPanel id="hearth" active={activeTab}>
                    <div className="larder__pane">
                        <MealPlanner
                            plan={mealPlan}
                            recipes={recipes}
                            onAddToDay={openPicker}
                            onClearDay={clearDay}
                        />
                    </div>
                </TabPanel>

                <TabPanel id="menus" active={activeTab}>
                    <MenuBuilder
                        recipes={recipes}
                        menus={menus}
                        onSaveMenu={addMenu}
                        onUpdateMenu={updateMenu}
                        onDeleteMenu={deleteMenu}
                        creating={isBuildingMenu}
                        onCreatingChange={setIsBuildingMenu}
                    />
                </TabPanel>

                <TabPanel id="pantry" active={activeTab}>
                    <div className="larder__pane stack">
                        <LarderFilters
                            search={pantrySearch}
                            onSearch={setPantrySearch}
                            searchPlaceholder="Search provisions..."
                            filter={pantryFilter}
                            onFilter={setPantryFilter}
                            filterLabel="Category"
                            filterAllLabel="All Categories"
                            filterOptions={Object.keys(ingredientsByCategory)}
                            sort={pantrySort}
                            onSort={setPantrySort}
                            sortOptions={PANTRY_SORTS}
                        />

                        {showFlatPantry ? (
                            processedPantry.length === 0 ? (
                                <EmptyState
                                    icon={<GiHerbsBundle />}
                                    message="No provisions match your criteria."
                                    actionLabel="New Provision"
                                    onAction={() => setIsProvisionModalOpen(true)}
                                />
                            ) : (
                                <div className="pantry-grid">
                                    {processedPantry.map(item => (
                                        <PantryItem
                                            key={item.id}
                                            item={item}
                                            pantryStock={pantryStock}
                                            removeAlias={removeAlias}
                                            addAlias={addAlias}
                                            updateIngredient={updateIngredient}
                                            togglePantryStock={togglePantryStock}
                                            deleteIngredient={deleteIngredient}
                                        />
                                    ))}
                                </div>
                            )
                        ) : Object.keys(ingredientsByCategory).length === 0 ? (
                            <EmptyState
                                icon={<GiHerbsBundle />}
                                message="The pantry stands empty."
                                hint="Catalogue a provision to begin."
                                actionLabel="New Provision"
                                onAction={() => setIsProvisionModalOpen(true)}
                            />
                        ) : (
                            Object.entries(ingredientsByCategory).map(([category, items]) => {
                                // If filtering by category, only show that category
                                if (pantryFilter && category !== pantryFilter) return null;

                                return (
                                    <section key={category} className="pantry-group">
                                        <h3 className="section-title">{category}</h3>
                                        <div className="pantry-grid">
                                            {items.map(item => (
                                                <PantryItem
                                                    key={item.id}
                                                    item={item}
                                                    pantryStock={pantryStock}
                                                    removeAlias={removeAlias}
                                                    addAlias={addAlias}
                                                    updateIngredient={updateIngredient}
                                                    togglePantryStock={togglePantryStock}
                                                    deleteIngredient={deleteIngredient}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                );
                            })
                        )}
                    </div>
                </TabPanel>

                <TabPanel id="provisions" active={activeTab}>
                    <div className="larder__pane larder__pane--narrow">
                        <GroceryList plan={mealPlan} recipes={recipes} inputRef={groceryInputRef} />
                    </div>
                </TabPanel>
            </div>

            <DaySelector
                isOpen={isDaySelectorOpen}
                onClose={() => setIsDaySelectorOpen(false)}
                onSelect={handleDaySelect}
            />

            {/* The Hearth's recipe picker */}
            <Modal
                open={picker.open}
                onClose={closePicker}
                title={picker.day ? `Plan for ${picker.day}` : 'Plan a Meal'}
                footer={<Button variant="ghost" onClick={closePicker}>Cancel</Button>}
            >
                <Field
                    label="Seek formula"
                    type="search"
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search formulas..."
                />
                <div className="recipe-picker">
                    {pickerResults.map(recipe => (
                        <button
                            key={recipe.id}
                            type="button"
                            className="recipe-picker__item"
                            onClick={() => handlePickRecipe(recipe)}
                        >
                            <span className="recipe-picker__title">{recipe.title}</span>
                            <span className="muted">{recipe.total_time || ''}</span>
                        </button>
                    ))}
                    {pickerResults.length === 0 && (
                        <EmptyState
                            icon={<GiCauldron />}
                            message="No formulae answer to that name."
                            hint="Add a new formula to begin."
                        />
                    )}
                </div>
            </Modal>

            {/* Pantry quick-add */}
            <Modal
                open={isProvisionModalOpen}
                onClose={closeProvisionModal}
                title="NEW PROVISION"
                footer={(
                    <>
                        <Button variant="ghost" onClick={closeProvisionModal}>Cancel</Button>
                        <Button variant="solid" onClick={handleAddProvision} disabled={!newProvision.name.trim()}>
                            ADD TO PANTRY
                        </Button>
                    </>
                )}
            >
                <Field
                    label="Name"
                    type="text"
                    value={newProvision.name}
                    onChange={(e) => setNewProvision(p => ({ ...p, name: e.target.value }))}
                    placeholder="Name (e.g. Saffron)"
                />
                <div className="field-row">
                    <Field label="Category">
                        <select
                            className="select"
                            value={newProvision.category}
                            onChange={(e) => setNewProvision(p => ({ ...p, category: e.target.value }))}
                        >
                            {PROVISION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </Field>
                    <div className="field larder-symbol">
                        <span className="field__label" id="provision-symbol">Symbol</span>
                        <Button
                            label="Choose provision symbol"
                            aria-describedby="provision-symbol"
                            aria-expanded={showEmojiPicker}
                            className="larder-symbol__btn"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            {newProvision.icon}
                        </Button>
                        {showEmojiPicker && (
                            <div className="larder-symbol__picker">
                                <EmojiPicker
                                    theme="dark"
                                    width={300}
                                    onEmojiClick={(emojiData) => {
                                        setNewProvision(p => ({ ...p, icon: emojiData.emoji }));
                                        setShowEmojiPicker(false);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Larder;
