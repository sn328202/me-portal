import React, { useState, useMemo } from 'react';
import {
    GiCook, GiMeal, GiClockwork, GiTrashCan, GiScrollQuill,
    GiMagicPotion, GiPencil, GiThirdEye, GiShop, GiHourglass
} from 'react-icons/gi';
import MenuView from './MenuView';
import CookPlan from './CookPlan';
import { Button, Card, ConfirmButton, EmptyState, Field, Stat } from './ui';

const COURSES = ['Appetizer', 'Starter', 'Main Course', 'Side', 'Dessert', 'Potable'];

const MenuBuilder = ({
    recipes,
    menus,
    onSaveMenu,
    onUpdateMenu,
    onDeleteMenu,
    onSetServeTime,
    onSavePlan,
    creating,
    onCreatingChange
}) => {
    const [viewingMenu, setViewingMenu] = useState(null);
    const [planningId, setPlanningId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [newMenu, setNewMenu] = useState({ title: '', occasion: '', notes: '' });
    const [titleError, setTitleError] = useState('');
    const [selectedRecipes, setSelectedRecipes] = useState([]); // Array of { recipe_id, course_name, title, image_url }
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCourse, setActiveCourse] = useState('Main Course');
    const [bought, setBought] = useState({ name: '', note: '' });

    // Aggregate stats calculation
    const stats = useMemo(() => {
        let totalPrep = 0;
        let totalCook = 0;

        selectedRecipes.forEach(mr => {
            const recipe = recipes.find(r => r.id === mr.recipe_id);
            if (recipe) {
                const parse = (timeStr) => {
                    if (!timeStr) return 0;
                    const hMatch = String(timeStr).match(/(\d+)\s*h/i);
                    const mMatch = String(timeStr).match(/(\d+)\s*m/i);
                    let total = 0;
                    if (hMatch) total += parseInt(hMatch[1]) * 60;
                    if (mMatch) total += parseInt(mMatch[1]);
                    return total || parseInt(timeStr) || 0;
                };
                totalPrep += parse(recipe.prep_time);
                totalCook += parse(recipe.cook_time);
            }
        });

        const format = (mins) => {
            if (mins === 0) return '0m';
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();
        };

        return {
            prep: format(totalPrep),
            cook: format(totalCook),
            total: format(totalPrep + totalCook),
            count: selectedRecipes.length
        };
    }, [selectedRecipes, recipes]);

    const filteredRecipes = useMemo(() => {
        const q = searchQuery.toLowerCase();
        if (!q) return recipes.slice(0, 20); // Show more by default
        return recipes.filter(r =>
            (r.title || '').toLowerCase().includes(q) ||
            r.tags?.some(t => t.toLowerCase().includes(q))
        ).slice(0, 20);
    }, [recipes, searchQuery]);

    const handleAddRecipe = (recipe) => {
        setSelectedRecipes([...selectedRecipes, {
            recipe_id: recipe.id,
            course_name: activeCourse,
            title: recipe.title,
            image_url: recipe.image_url
        }]);
    };

    /**
     * Something she is not cooking.
     *
     * Half of a menu is often bought: the Diet Coke, the cookies from Whole
     * Foods, the bread. A menu that can only hold recipes makes her either
     * write a fake recipe for a bottle of Coke or leave the drinks off the
     * menu entirely, and the drinks are on the table either way.
     */
    const handleAddBought = (e) => {
        e?.preventDefault?.();
        const name = bought.name.trim();
        if (!name) return;
        setSelectedRecipes([...selectedRecipes, {
            recipe_id: null,
            item_name: name,
            item_note: bought.note.trim(),
            course_name: activeCourse,
        }]);
        setBought({ name: '', note: '' });
    };

    const handleRemoveRecipe = (index) => {
        setSelectedRecipes(selectedRecipes.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!newMenu.title) {
            setTitleError('A theme requires a title.');
            return;
        }
        setTitleError('');
        if (editingId) {
            await onUpdateMenu(editingId, newMenu, selectedRecipes);
        } else {
            await onSaveMenu(newMenu, selectedRecipes);
        }
        handleClose();
    };

    const handleEdit = (menu) => {
        setEditingId(menu.id);
        setNewMenu({
            title: menu.title,
            occasion: menu.occasion || '',
            notes: menu.notes || ''
        });
        const mRecipes = menu.user_larder_menu_recipes?.map(mr => ({
            recipe_id: mr.recipe_id,
            course_name: mr.course_name,
            title: mr.recipes?.title,
            image_url: mr.recipes?.image_url,
            item_name: mr.item_name,
            item_note: mr.item_note,
        })) || [];
        setSelectedRecipes(mRecipes);
        onCreatingChange(true);
    };

    const handleClose = () => {
        onCreatingChange(false);
        setEditingId(null);
        setNewMenu({ title: '', occasion: '', notes: '' });
        setTitleError('');
        setSelectedRecipes([]);
        setSearchQuery('');
        setBought({ name: '', note: '' });
    };

    const groupedSelection = selectedRecipes.reduce((acc, mr) => {
        if (!acc[mr.course_name]) acc[mr.course_name] = [];
        acc[mr.course_name].push(mr);
        return acc;
    }, {});

    if (creating) {
        return (
            <div className="menu-builder">
                {/* Left: Recipe Archive */}
                <div className="menu-builder__archive">
                    <h3 className="section-title">
                        <GiScrollQuill /> THE ARCHIVES
                    </h3>
                    <Field
                        label="Seek formula"
                        type="search"
                        placeholder="Seek formula..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && filteredRecipes.length > 0) {
                                e.preventDefault();
                                handleAddRecipe(filteredRecipes[0]);
                                setSearchQuery('');
                            }
                        }}
                        autoFocus
                    />
                    <div className="menu-builder__archive-list">
                        {filteredRecipes.map(r => (
                            <button
                                key={r.id}
                                type="button"
                                className="menu-builder__archive-item"
                                onClick={() => handleAddRecipe(r)}
                            >
                                <span className="menu-builder__thumb">
                                    {r.image_url
                                        ? <img src={r.image_url} alt="" />
                                        : <GiCook size={20} />}
                                </span>
                                <span className="menu-builder__archive-text">
                                    <span>{r.title}</span>
                                    <span className="muted">{r.total_time || 'No time set'}</span>
                                </span>
                            </button>
                        ))}
                        {filteredRecipes.length === 0 && (
                            <EmptyState
                                icon={<GiScrollQuill />}
                                message="No formulae answer to that name."
                            />
                        )}
                    </div>

                    {/* Not everything on a menu is cooked. */}
                    <form className="menu-builder__bought" onSubmit={handleAddBought}>
                        <h4 className="menu-builder__bought-title">
                            <GiShop /> BOUGHT, NOT COOKED
                        </h4>
                        <Field
                            label={`Name — goes under ${activeCourse}`}
                            type="text"
                            placeholder="Diet Coke, Whole Foods cookies..."
                            value={bought.name}
                            onChange={(e) => setBought({ ...bought, name: e.target.value })}
                        />
                        <Field
                            label="Note (optional)"
                            type="text"
                            placeholder="2 bottles, chill Friday"
                            value={bought.note}
                            onChange={(e) => setBought({ ...bought, note: e.target.value })}
                        />
                        <Button type="submit" size="sm" block disabled={!bought.name.trim()}>
                            Add to {activeCourse}
                        </Button>
                    </form>
                </div>

                {/* Right: Menu Canvas */}
                <div className="menu-builder__canvas">
                    <div className="menu-builder__canvas-head">
                        <div className="menu-builder__identity">
                            <Field
                                label="Title"
                                type="text"
                                placeholder="A Menu for..."
                                value={newMenu.title}
                                error={titleError}
                                onChange={(e) => setNewMenu({ ...newMenu, title: e.target.value })}
                                className="menu-builder__title-field"
                            />
                            <Field
                                label="Occasion"
                                type="text"
                                placeholder="The Occasion (Optional)"
                                value={newMenu.occasion}
                                onChange={(e) => setNewMenu({ ...newMenu, occasion: e.target.value })}
                            />
                        </div>
                        <div className="menu-builder__canvas-actions">
                            <Button variant="ghost" onClick={handleClose}>ABANDON</Button>
                            <Button variant="solid" onClick={handleSave}>
                                {editingId ? 'UPDATED SEAL' : 'SEAL MENU'}
                            </Button>
                        </div>
                    </div>

                    {/* Stats Ribbon */}
                    <div className="stat-row">
                        <Stat icon={<GiClockwork />} value={stats.total} label="Total Labor" />
                        <Stat icon={<GiMeal />} value={stats.count} label="Components" />
                    </div>

                    {/* Course Selection */}
                    <div className="menu-builder__courses" role="group" aria-label="Course for the next addition">
                        {COURSES.map(c => (
                            <Button
                                key={c}
                                size="sm"
                                variant={activeCourse === c ? 'solid' : 'default'}
                                aria-pressed={activeCourse === c}
                                onClick={() => setActiveCourse(c)}
                            >
                                {c}
                            </Button>
                        ))}
                    </div>

                    {/* Menu Content */}
                    <div className="menu-builder__sheet">
                        {Object.keys(groupedSelection).length === 0 && (
                            <EmptyState
                                icon={<GiMeal />}
                                message="The page is blank. Select formulae from the archive to begin."
                            />
                        )}
                        {COURSES.map(course => groupedSelection[course] && (
                            <div key={course} className="menu-builder__course-group">
                                <h4 className="menu-builder__course-title">{course}</h4>
                                <div className="menu-builder__course-grid">
                                    {groupedSelection[course].map((mr, idx) => {
                                        const name = mr.title || mr.item_name;
                                        return (
                                            <div key={idx} className="menu-builder__dish">
                                                <span className="menu-builder__thumb">
                                                    {mr.image_url
                                                        ? <img src={mr.image_url} alt="" />
                                                        : !mr.recipe_id && <GiShop size={16} />}
                                                </span>
                                                <span className="menu-builder__dish-title">
                                                    {name}
                                                    {mr.item_note && (
                                                        <span className="menu-builder__dish-note">{mr.item_note}</span>
                                                    )}
                                                </span>
                                                <Button
                                                    icon
                                                    size="sm"
                                                    label={`Remove ${name} from menu`}
                                                    onClick={() => handleRemoveRecipe(selectedRecipes.indexOf(mr))}
                                                >
                                                    <GiTrashCan />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="menu-list">
            {menus.length === 0 ? (
                <EmptyState
                    icon={<GiMeal />}
                    message="No menus have been curated yet."
                    actionLabel="New Menu"
                    onAction={() => onCreatingChange(true)}
                />
            ) : (
                <div className="menu-list__grid">
                    {menus.map(menu => (
                        <Card
                            key={menu.id}
                            className="menu-card"
                            title={menu.title}
                            actions={(
                                <>
                                    <Button
                                        icon
                                        size="sm"
                                        label={`View menu ${menu.title}`}
                                        onClick={() => setViewingMenu(menu)}
                                    >
                                        <GiThirdEye />
                                    </Button>
                                    <Button
                                        icon
                                        size="sm"
                                        label={`Plan the cooking of ${menu.title}`}
                                        onClick={() => setPlanningId(menu.id)}
                                    >
                                        <GiHourglass />
                                    </Button>
                                    <Button
                                        icon
                                        size="sm"
                                        label={`Edit menu ${menu.title}`}
                                        onClick={() => handleEdit(menu)}
                                    >
                                        <GiPencil />
                                    </Button>
                                    <ConfirmButton
                                        label={`Delete menu ${menu.title}`}
                                        confirmLabel="Confirm Erasure?"
                                        icon={<GiTrashCan />}
                                        onConfirm={() => onDeleteMenu(menu.id)}
                                    />
                                </>
                            )}
                        >
                            <p className="menu-card__occasion">{menu.occasion || 'General Feast'}</p>

                            <div className="menu-card__dishes">
                                {menu.user_larder_menu_recipes?.slice(0, 3).map((mr, idx) => (
                                    <div key={idx} className="menu-card__dish">
                                        <span className="menu-builder__thumb menu-builder__thumb--sm">
                                            {mr.recipes?.image_url && <img src={mr.recipes.image_url} alt="" />}
                                        </span>
                                        <span className="muted">{mr.course_name}:</span>
                                        <span>{mr.recipes?.title || mr.item_name}</span>
                                    </div>
                                ))}
                                {(menu.user_larder_menu_recipes?.length || 0) > 3 && (
                                    <span className="menu-card__more">
                                        + {menu.user_larder_menu_recipes.length - 3} more formulae...
                                    </span>
                                )}
                            </div>

                            <div className="menu-card__foot">
                                <span><GiMagicPotion /> {menu.user_larder_menu_recipes?.length || 0} Dishes</span>
                                {menu.plan?.steps?.length ? (
                                    <span><GiHourglass /> {menu.plan.steps.length} step plan</span>
                                ) : (
                                    <span>{new Date(menu.created_at).toLocaleDateString()}</span>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {viewingMenu && (
                <MenuView
                    menu={viewingMenu}
                    recipes={recipes}
                    onClose={() => setViewingMenu(null)}
                />
            )}

            {/* Read from the live list rather than a copy: ticking a step saves
                and re-renders, and a copy taken on open would show the plan as
                it was before the tick. */}
            {planningId && menus.find(m => m.id === planningId) && (
                <CookPlan
                    menu={menus.find(m => m.id === planningId)}
                    onClose={() => setPlanningId(null)}
                    onSetServeTime={onSetServeTime}
                    onSavePlan={onSavePlan}
                />
            )}
        </div>
    );
};

export default MenuBuilder;
