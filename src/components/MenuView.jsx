import React, { useState, useMemo } from 'react';
import { GiCancel, GiFountainPen, GiScrollUnfurled } from 'react-icons/gi';
import { Button, Field, Modal } from './ui';
import '../styles/MenuPrint.css';

const COURSES = ['Appetizer', 'Starter', 'Main Course', 'Side', 'Dessert', 'Potable'];

const MenuView = ({ menu, recipes, onClose }) => {
    const [includeRecipes, setIncludeRecipes] = useState(false);

    // Group recipes by course
    const groupedRecipes = useMemo(() => {
        const grouped = {};
        menu.user_larder_menu_recipes?.forEach(mr => {
            const course = mr.course_name || 'General';
            if (!grouped[course]) grouped[course] = [];

            // Find full recipe data
            const fullRecipe = recipes.find(r => r.id === mr.recipe_id);
            if (fullRecipe) {
                grouped[course].push(fullRecipe);
            }
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
                        <GiCancel /> BACK TO ARCHIVE
                    </Button>

                    <div className="menu-actions__right">
                        <Field label="INCLUDE FULL RECIPES" className="menu-actions__toggle">
                            <input
                                type="checkbox"
                                checked={includeRecipes}
                                onChange={e => setIncludeRecipes(e.target.checked)}
                            />
                        </Field>
                        <Button variant="solid" onClick={handlePrint}>
                            <GiScrollUnfurled /> PRINT / EXPORT
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
                                    {groupedRecipes[course].map(recipe => (
                                        <div key={recipe.id} className="recipe-item">
                                            <h3 className="menu-paper__dish">{recipe.title}</h3>
                                            <div className="menu-paper__dish-tags">
                                                {recipe.tags?.join(' • ')}
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
                        {Object.values(groupedRecipes).flat().map(recipe => (
                            <div key={recipe.id} className="recipe-page">
                                <h2 className="recipe-page__title">{recipe.title}</h2>

                                <div className="recipe-page__meta">
                                    <div><strong>Prep:</strong> {recipe.prep_time}</div>
                                    <div><strong>Cook:</strong> {recipe.cook_time}</div>
                                    <div><strong>Yield:</strong> {recipe.servings}</div>
                                </div>

                                <div className="recipe-page__columns">
                                    <div>
                                        <h4 className="recipe-page__label">Provisions</h4>
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
