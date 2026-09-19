import React, { useState, useMemo, useCallback, useRef, useEffect, Suspense, lazy } from 'react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
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
import { useDayPlans } from '../hooks/useDayPlans';
import {
    GiQuill, GiMagnifyingGlass, GiFunnel, GiHourglass, GiCookingPot,
    GiHerbsBundle, GiScrollQuill, GiScrollUnfurled, GiCauldron, GiTrashCan,
    GiSpellBook
} from 'react-icons/gi';
// The emoji dataset is ~200KB and lives behind three separate clicks. Loaded
// at module scope it was part of the Larder's first paint.
const EmojiPicker = lazy(() => import('emoji-picker-react'));
import { readToken, isLight } from '../utils/mapStyle';
import {
    Button, Card, ConfirmButton, EmptyState, Field, Modal, PageHeader, Tabs, TabPanel, Tag
} from '../components/ui';
import '../styles/Larder.css';

/* In the order the kitchen is actually used: what you can cook, what you
   have to cook it with, what you are cooking this week, and only then the
   occasional grand menu. The Hearth used to sit second, before the Pantry
   had been consulted, which is planning a week before looking in a cupboard.

   Each tab wears the icon of its own primary action - the Pantry's is the
   herbs on its "New Provision" button, the Menu Builder's the quill on its
   "New Menu" - so the button and the tab that leads to it are one thing. */
const TABS = [
    { id: 'collection', label: 'Recipes', icon: <GiSpellBook /> },
    { id: 'pantry', label: 'Pantry', icon: <GiHerbsBundle /> },
    { id: 'hearth', label: 'Meal plan', icon: <GiCauldron /> },
    { id: 'menus', label: 'Menus', icon: <GiScrollQuill /> }
];

/* All four, or the header changes height every time she switches tab. */
const TAB_SUBTITLES = {
    collection: 'Everything you can cook, and how much of it is already in the cupboard.',
    pantry: 'What you keep in, so a recipe can tell you what you are missing.',
    hearth: "What you're cooking this week, and what to buy for it.",
    menus: "Menus you've built, and the cooking schedule for each."
};

const PROVISION_CATEGORIES = ['Pantry', 'Produce', 'Dairy', 'Protein', 'Spices'];

/**
 * '2026-08-29' -> 'Saturday, Aug 29'. The planner speaks in dates now, but a
 * modal title reading "Plan for 2026-08-29" is nobody's idea of a heading.
 */
const planDayLabel = (iso) => {
    if (!iso) return '';
    const date = parseISO(iso);
    if (isToday(date)) return 'today';
    if (isTomorrow(date)) return 'tomorrow';
    return format(date, 'EEEE, MMM d');
};

const RECIPE_SORTS = [
    { value: 'newest', label: 'Newest first' },
    { value: 'title', label: 'A–Z' },
    { value: 'match', label: 'Pantry match' }
];

const PANTRY_SORTS = [
    { value: 'category', label: 'Category' },
    { value: 'name', label: 'Name (A–Z)' },
    { value: 'stocked', label: 'In stock first' }
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

/* Memoised, and handed a boolean rather than the whole stock map: the pantry
   draws 260 of these, and every tap on one of them used to re-render all of
   them. The actions come from the pantry store and are stable, which is what
   makes the memo hold. */
const PantryItem = React.memo(({
    item, inStock, togglePantryStock, deleteIngredient,
    removeAlias, addAlias, updateIngredient,
}) => {
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
                    <Suspense fallback={<span className="muted">Loading symbols…</span>}>
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
                    </Suspense>
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
                    <Tag tone={inStock ? 'gold' : 'default'}>{inStock ? 'In stock' : 'Out of stock'}</Tag>
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
                            aria-label={`Stop matching "${alias}" to ${item.label}`}
                            onClick={() => removeAlias?.(item.id, alias)}
                        >
                            {alias} <span aria-hidden="true">×</span>
                            <span className="visually-hidden">remove this name</span>
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
                label={`Delete ${item.label} from your pantry`}
                confirmLabel="Confirm delete"
                icon={<GiTrashCan />}
                onConfirm={() => deleteIngredient(item.id)}
            />
        </div>
    );
});

PantryItem.displayName = 'PantryItem';

const Larder = () => {
    const [activeTab, setActiveTab] = useState('collection'); // 'collection', 'hearth', 'menus', 'pantry'
    const [view, setView] = useState('list'); // 'list', 'form', 'detail', 'cook'
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [viewingRecipe, setViewingRecipe] = useState(null);
    const [isDaySelectorOpen, setIsDaySelectorOpen] = useState(false);
    const [selectedRecipeForPlan, setSelectedRecipeForPlan] = useState(null);

    // Filter & Sort State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTag, setFilterTag] = useState('');
    const [sortBy, setSortBy] = useState('newest'); // 'newest', 'title', 'match'

    const {
        recipes, loading, error, notice: recipeNotice, clearNotice: clearRecipeNotice,
        addRecipe, deleteRecipe, updateRecipe, mealPlan, addToPlan, clearDay, importRecipe,
    } = useRecipes();
    const {
        ingredientsByCategory, pantryStock, togglePantryStock, addCustomIngredient,
        deleteIngredient, ingredientsByName, matcher, addManyIngredients, addAlias,
        removeAlias, ingredients, updateIngredient,
        loading: pantryLoading, error: pantryNotice, clearError: clearPantryNotice,
    } = useIngredients();
    const {
        menus, loading: menusLoading, notice: menuNotice, clearNotice: clearMenuNotice,
        addMenu, updateMenu, deleteMenu, setServeTime, savePlan,
    } = useMenus();
    const {
        dayPlans, notice: dayNotice, clearNotice: clearDayNotice,
        setServeTime: setDayServeTime, savePlan: saveDayPlan,
    } = useDayPlans();

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
    /**
     * Pantry match for the recipe list.
     *
     * This was a third hand-rolled copy of the same exact-string lookup that
     * RecipeDetail and ProvisionsWidget each had. All three now share one
     * matcher, so a recipe cannot report 20% here and 60% when opened.
     *
     * The matcher remembers every line it has already been asked about for as
     * long as the pantry stands still, so calling this again for a recipe it
     * has already seen costs a map lookup per ingredient.
     */
    const withPantryMatch = useCallback((recipe) => {
        const result = matcher.matchRecipe(recipe.ingredients || []);
        return {
            ...recipe,
            percentage: result.percent,
            // "Missing" in the list has always meant "not in the cupboard right
            // now", which includes things the pantry knows about but has run
            // out of - not only things it has never heard of.
            missing: result.lines.filter((l) => !l.inStock),
            unknown: result.missing,
            total: result.total,
            // Handed to the card so it does not match the same six ingredients
            // a second time to draw its cover.
            lines: result.lines,
        };
    }, [matcher]);

    const filteredRecipes = useMemo(() => {
        /* Search and filter first, match second.
           Matching a recipe is the most expensive thing on the page, and this
           used to do it to all of them before reading the search box — so
           typing five letters matched the whole collection five times over and
           threw almost all of it away. Now a search that leaves three recipes
           costs three matches. */
        let result = recipes;

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

        result = result.map(withPantryMatch);

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
    }, [recipes, searchQuery, filterTag, sortBy, withPantryMatch]);

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

    /**
     * The same rows, in their categories.
     *
     * Searching used to swap the grouped pantry for a flat one on the first
     * keystroke and swap it back on the last — the headings appeared and
     * vanished under her thumb. It filters inside the groups now, and only the
     * sort decides whether there are groups at all.
     */
    const groupedPantry = useMemo(() => {
        const groups = new Map();
        for (const item of processedPantry) {
            const category = item.category || 'Uncategorized';
            if (!groups.has(category)) groups.set(category, []);
            groups.get(category).push(item);
        }
        return [...groups.entries()];
    }, [processedPantry]);

    const showFlatPantry = pantrySort !== 'category';

    /* Something a write failed at, said once, at the top of the page. These
       were console.error alone — the row sprang back and nothing said why. */
    const notice = recipeNotice || menuNotice || dayNotice || pantryNotice || null;
    const dismissNotice = () => {
        clearRecipeNotice(); clearMenuNotice(); clearDayNotice(); clearPantryNotice();
    };

    /* A tab is a different page. Landing halfway down the pantry because the
       recipe list had been scrolled is disorienting every single time. */
    const contentRef = useRef(null);
    useEffect(() => {
        if (contentRef.current) contentRef.current.scrollTop = 0;
    }, [activeTab]);

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
                <p>Loading your recipes…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="larder-error">
                <EmptyState
                    icon={<GiCauldron />}
                    message="Couldn't load the Larder."
                    /* The raw Supabase message used to be printed here, along
                       with an instruction to run a SQL script. */
                    hint="Check your connection and reload. If it keeps failing, the Larder's tables may not be set up yet."
                />
            </div>
        );
    }

    // Every tab gets its own primary action, named for that tab.
    const headerAction = (() => {
        if (activeTab === 'collection') {
            return view === 'list' ? (
                <Button variant="primary" onClick={handleCreate}>
                    <GiQuill /> New recipe
                </Button>
            ) : (
                <Button variant="ghost" onClick={handleCancel}>
                    <GiScrollUnfurled /> Back to recipes
                </Button>
            );
        }
        if (activeTab === 'hearth') {
            return (
                <Button variant="primary" onClick={() => openPicker(null)}>
                    <GiCookingPot /> Add a meal
                </Button>
            );
        }
        if (activeTab === 'menus') {
            return isBuildingMenu ? null : (
                <Button variant="primary" onClick={() => setIsBuildingMenu(true)}>
                    <GiScrollQuill /> New menu
                </Button>
            );
        }
        if (activeTab === 'pantry') {
            return (
                <Button variant="primary" onClick={() => setIsProvisionModalOpen(true)}>
                    <GiHerbsBundle /> Add ingredient
                </Button>
            );
        }
        return null;
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

            {notice && (
                <div className="larder__notice" role="status">
                    <span>{notice}</span>
                    <Button size="sm" variant="ghost" onClick={dismissNotice}>Dismiss</Button>
                </div>
            )}

            <div className="larder__content" ref={contentRef}>
                <TabPanel id="collection" active={activeTab}>
                    {view === 'list' ? (
                        <div className="stack">
                            <LarderFilters
                                search={searchQuery}
                                onSearch={setSearchQuery}
                                searchPlaceholder="Search recipes…"
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
                                searching={Boolean(searchQuery || filterTag)}
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
                    {/* The week and the shop it implies, side by side. They were
                        two tabs, which meant planning Thursday's dinner and
                        seeing what it added to the list were two clicks apart -
                        and the list is the whole reason the plan exists. */}
                    <div className="larder__pane hearth">
                        <div className="hearth__plan">
                            <MealPlanner
                                plan={mealPlan}
                                recipes={recipes}
                                onAddToDay={openPicker}
                                onClearDay={clearDay}
                                dayPlans={dayPlans}
                                onSetServeTime={setDayServeTime}
                                onSavePlan={saveDayPlan}
                            />
                        </div>
                        <aside className="hearth__shop" aria-label="What to buy">
                            <h3 className="hearth__shop-title">What to buy</h3>
                            <GroceryList plan={mealPlan} recipes={recipes} inputRef={groceryInputRef} />
                        </aside>
                    </div>
                </TabPanel>

                <TabPanel id="menus" active={activeTab}>
                    <MenuBuilder
                        recipes={recipes}
                        menus={menus}
                        loading={menusLoading}
                        onSaveMenu={addMenu}
                        onUpdateMenu={updateMenu}
                        onDeleteMenu={deleteMenu}
                        onSetServeTime={setServeTime}
                        onSavePlan={savePlan}
                        creating={isBuildingMenu}
                        onCreatingChange={setIsBuildingMenu}
                    />
                </TabPanel>

                <TabPanel id="pantry" active={activeTab}>
                    <div className="larder__pane stack">
                        <LarderFilters
                            search={pantrySearch}
                            onSearch={setPantrySearch}
                            searchPlaceholder="Search ingredients…"
                            filter={pantryFilter}
                            onFilter={setPantryFilter}
                            filterLabel="Category"
                            filterAllLabel="All Categories"
                            filterOptions={Object.keys(ingredientsByCategory)}
                            sort={pantrySort}
                            onSort={setPantrySort}
                            sortOptions={PANTRY_SORTS}
                        />

                        {pantryLoading ? null : processedPantry.length === 0 ? (
                            /* Three different nothings, and they want three
                               different sentences: an empty pantry, a search
                               that found none of it, and a category with
                               nothing in it. */
                            ingredients.length === 0 ? (
                                <EmptyState
                                    icon={<GiHerbsBundle />}
                                    message="Your pantry is empty."
                                    hint="Add the things you usually keep in, and recipes can tell you what you're missing."
                                    actionLabel="Add ingredient"
                                    onAction={() => setIsProvisionModalOpen(true)}
                                />
                            ) : (
                                <EmptyState
                                    icon={<GiHerbsBundle />}
                                    message="No ingredients match that search."
                                    hint="Try a different word, or change the category filter."
                                />
                            )
                        ) : showFlatPantry ? (
                            <div className="pantry-grid">
                                {processedPantry.map(item => (
                                    <PantryItem
                                        key={item.id}
                                        item={item}
                                        inStock={!!pantryStock[item.id]}
                                        removeAlias={removeAlias}
                                        addAlias={addAlias}
                                        updateIngredient={updateIngredient}
                                        togglePantryStock={togglePantryStock}
                                        deleteIngredient={deleteIngredient}
                                    />
                                ))}
                            </div>
                        ) : (
                            groupedPantry.map(([category, items]) => (
                                <section key={category} className="pantry-group">
                                    <h3 className="section-title">{category}</h3>
                                    <div className="pantry-grid">
                                        {items.map(item => (
                                            <PantryItem
                                                key={item.id}
                                                item={item}
                                                inStock={!!pantryStock[item.id]}
                                                removeAlias={removeAlias}
                                                addAlias={addAlias}
                                                updateIngredient={updateIngredient}
                                                togglePantryStock={togglePantryStock}
                                                deleteIngredient={deleteIngredient}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))
                        )}
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
                title={picker.day ? `Add to ${planDayLabel(picker.day)}` : 'Choose a recipe'}
                footer={<Button variant="ghost" onClick={closePicker}>Cancel</Button>}
            >
                <Field
                    label="Search recipes"
                    type="search"
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search by name"
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
                            message="No recipes match that search."
                            hint="Try a different word, or close this and add the recipe first."
                        />
                    )}
                </div>
            </Modal>

            {/* Pantry quick-add */}
            <Modal
                open={isProvisionModalOpen}
                onClose={closeProvisionModal}
                title="Add an ingredient"
                footer={(
                    <>
                        <Button variant="ghost" onClick={closeProvisionModal}>Cancel</Button>
                        <Button variant="solid" onClick={handleAddProvision} disabled={!newProvision.name.trim()}>
                            Add to pantry
                        </Button>
                    </>
                )}
            >
                <Field
                    label="Name"
                    type="text"
                    value={newProvision.name}
                    onChange={(e) => setNewProvision(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. saffron"
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
                            label="Choose a symbol"
                            aria-describedby="provision-symbol"
                            aria-expanded={showEmojiPicker}
                            className="larder-symbol__btn"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            {newProvision.icon}
                        </Button>
                        {showEmojiPicker && (
                            <div className="larder-symbol__picker">
                                <Suspense fallback={<span className="muted">Loading symbols…</span>}>
                                <EmojiPicker
                                    // Was pinned to dark: a black slab of
                                    // unreadable emoji on every light skin.
                                    theme={isLight(readToken('--bg-panel', '#ffffff')) ? 'light' : 'dark'}
                                    width={300}
                                    onEmojiClick={(emojiData) => {
                                        setNewProvision(p => ({ ...p, icon: emojiData.emoji }));
                                        setShowEmojiPicker(false);
                                    }}
                                />
                                </Suspense>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Larder;
