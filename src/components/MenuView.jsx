import React, { useState, useMemo } from 'react';
import { GiCancel, GiFountainPen, GiScrollUnfurled } from 'react-icons/gi';
import { Button, Field, Modal } from './ui';
import '../styles/MenuPrint.css';

const COURSES = ['Appetizer', 'Starter', 'Main Course', 'Side', 'Dessert', 'Potable'];

const MenuView = ({ menu, recipes, onClose }) => {
    const [includeRecipes, setIncludeRecipes] = useState(false);

    /* By course, and a course holds both kinds: the thing she cooked and the
       thing she bought. A printed menu that silently drops the drinks because
       no recipe answers to "Diet Coke" is a menu with no drinks on it. */
    const groupedRecipes = useMemo(() => {
        const grouped = {};
        menu.user_larder_menu_recipes?.forEach(mr => {
            const course = mr.course_name || 'General';
            const fullRecipe = mr.recipe_id ? recipes.find(r => r.id === mr.recipe_id) : null;
            const entry = fullRecipe
                ? { key: fullRecipe.id, title: fullRecipe.title, tags: fullRecipe.tags, recipe: fullRecipe }
                : (mr.item_name ? { key: `item-${mr.id || mr.item_name}`, title: mr.item_name, note: mr.item_note } : null);
            if (!entry) return;
            if (!grouped[course]) grouped[course] = [];
            grouped[course].push(entry);
        });
        return grouped;
    }, [menu, recipes]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal open onClose={onClose} size="full" labelledBy="menu-view-title">
            <div className="menu-view-container">
                {/* Control Bar - Hidden in Print */}
                <div className="menu-actions">
                    <Button variant="ghost" onClick={onClose}>
                        <GiCancel /> Back to menus
                    </Button>

                    <div className="menu-actions__right">
                        <Field label="Include full recipes" className="menu-actions__toggle">
                            <input
                                type="checkbox"
                                checked={includeRecipes}
                                onChange={e => setIncludeRecipes(e.target.checked)}
                            />
                        </Field>
                        <Button variant="solid" onClick={handlePrint}>
                            <GiScrollUnfurled /> Print
                        </Button>
                    </div>
                </div>

                {/* The actual Menu Card */}
                <div className="menu-paper">
                    {/* Decorative Borders */}
                    <div className="no-print menu-paper__frame" />

                    {/* Header */}
                    <div className="menu-paper__head">
                        <div className="menu-paper__mark"><GiFountainPen /></div>
                        <h1 id="menu-view-title" className="menu-paper__title">{menu.title}</h1>
                        {menu.occasion && (
                            <p className="menu-paper__occasion">— {menu.occasion} —</p>
                        )}
                    </div>

                    {/* Courses */}
                    <div className="menu-paper__body">
                        {COURSES.map(course => groupedRecipes[course] && (
                            <div key={course} className="course-section">
                                <h2 className="menu-paper__course">
                                    <span className="menu-paper__rule" />
                                    {course}
                                    <span className="menu-paper__rule" />
                                </h2>

                                <div className="menu-paper__dishes">
                                    {groupedRecipes[course].map(entry => (
                                        <div key={entry.key} className="recipe-item">
                                            <h3 className="menu-paper__dish">{entry.title}</h3>
                                            <div className="menu-paper__dish-tags">
                                                {entry.tags?.join(' • ') || entry.note}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="menu-paper__foot">
                        {menu.notes && <p className="menu-paper__notes">"{menu.notes}"</p>}
                        <p className="menu-paper__seal">THE LARDER • EST. 2026</p>
                    </div>
                </div>

                {/* Full Recipe Pages (Optional) */}
                {includeRecipes && (
                    <div className="menu-view__pages">
                        {Object.values(groupedRecipes).flat().map(({ recipe }) => recipe && (
                            <div key={recipe.id} className="recipe-page">
                                <h2 className="recipe-page__title">{recipe.title}</h2>

                                <div className="recipe-page__meta">
                                    <div><strong>Prep:</strong> {recipe.prep_time}</div>
                                    <div><strong>Cook:</strong> {recipe.cook_time}</div>
                                    <div><strong>Servings:</strong> {recipe.servings}</div>
                                </div>

                                <div className="recipe-page__columns">
                                    <div>
                                        <h4 className="recipe-page__label">Ingredients</h4>
                                        <ul className="provisions-list">
                                            {recipe.ingredients?.map((ing, i) => (
                                                <li key={i}>
                                                    <strong>{ing.amount} {ing.unit}</strong> {ing.item}
                                                    {ing.notes && <span className="recipe-page__note"> ({ing.notes})</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="recipe-page__label">Method</h4>
                                        <div className="recipe-page__method">{recipe.instructions}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default MenuView;
