import React, { useState, useMemo } from 'react';
import { useProvisions } from '../hooks/useProvisions'; // Shared state
import { useIngredients } from '../hooks/useIngredients';
import { findIngredient } from '../data/ingredients';
import { GiCheckMark, GiBasket } from 'react-icons/gi';
import { EmptyState, Field } from './ui';

const GroceryList = ({ plan, recipes, inputRef }) => {
    // 1. Shared Manual Items (from Dashboard)
    const { items: manualItems, addItem, toggleItem, clearChecked } = useProvisions();
    const { ingredientsByName } = useIngredients();
    const [newItemInput, setNewItemInput] = useState('');

    // 2. Aggregate Planned Ingredients (from Hearth)
    const plannedIngredients = useMemo(() => {
        const planned = [];
        if (plan && recipes) {
            Object.values(plan).flat().forEach(recipeId => {
                const recipe = recipes.find(r => r.id === recipeId);
                if (recipe) {
                    recipe.ingredients.forEach(ing => {
                        const uniqueKey = `planned-${recipe.id}-${ing.id}`;
                        planned.push({ ...ing, recipeName: recipe.title, uniqueKey, isPlanned: true });
                    });
                }
            });
        }
        return planned;
    }, [plan, recipes]);

    // 3. Categorize Everything
    const categoricalGroups = useMemo(() => {
        const groups = {};

        const addToGroup = (item, type, originalData) => {
            const itemName = (item.text || item.item || '').toLowerCase().trim();

            // Try to find category:
            // 1. User's Pantry (explicitly defined)
            // 2. Global Library (fuzzy match)
            // 3. Fallback to Miscellaneous
            const ingData = ingredientsByName[itemName] || findIngredient(itemName);
            const category = (ingData?.category || 'Miscellaneous').toUpperCase();

            if (!groups[category]) groups[category] = [];
            groups[category].push({ ...item, category, type, originalData });
        };

        manualItems.forEach(item => addToGroup(item, 'manual', item));
        plannedIngredients.forEach(item => addToGroup(item, 'planned', item));

        const sortedCategories = Object.keys(groups).sort((a, b) => {
            const order = ['PRODUCE', 'DAIRY', 'PROTEIN', 'PANTRY', 'SPICES', 'BAKERY', 'FROZEN'];
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            if (a === 'MISCELLANEOUS') return 1;
            if (b === 'MISCELLANEOUS') return -1;
            return a.localeCompare(b);
        });

        return { groups, sortedCategories };
    }, [manualItems, plannedIngredients, ingredientsByName]);

    const handleAddManual = (e) => {
        e.preventDefault();
        if (newItemInput.trim()) {
            addItem(newItemInput);
            setNewItemInput('');
        }
    };

    const isEmpty = manualItems.length === 0 && plannedIngredients.length === 0;

    if (isEmpty) {
        return (
            <div className="grocery-empty">
                <EmptyState
                    icon={<GiBasket />}
                    message={'"A list is but a promise to oneself."'}
                    hint="Plan meals in The Hearth or add items manually to generate your provisions list."
                />
                <form onSubmit={handleAddManual} className="grocery-empty__form">
                    <Field
                        label="Add manual item"
                        type="text"
                        value={newItemInput}
                        onChange={(e) => setNewItemInput(e.target.value)}
                        placeholder="Add manual item..."
                        ref={inputRef}
                    />
                </form>
            </div>
        );
    }

    return (
        <div className="grocery-paper">
            <h2 className="grocery-paper__title">
                <GiBasket /> Provisions
                {manualItems.some(i => i.checked) && (
                    <button
                        type="button"
                        onClick={clearChecked}
                        className="grocery-paper__clear"
                    >
                        Clear Checked
                    </button>
                )}
            </h2>

            <form onSubmit={handleAddManual} className="grocery-paper__form">
                <label className="visually-hidden" htmlFor="grocery-scribble">Scribble new item</label>
                <input
                    id="grocery-scribble"
                    ref={inputRef}
                    type="text"
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    placeholder="🖊️ Scribble new item..."
                    className="grocery-paper__input"
                />
            </form>

            <div className="grocery-paper__groups">
                {categoricalGroups.sortedCategories.map(cat => (
                    <div key={cat}>
                        <h4 className="grocery-paper__category">{cat}</h4>
                        <ul className="grocery-paper__list">
                            {categoricalGroups.groups[cat].map((item) => {
                                if (item.type === 'manual') {
                                    return (
                                        <li key={item.id} className="grocery-paper__row">
                                            <button
                                                type="button"
                                                className={[
                                                    'grocery-paper__check',
                                                    item.checked ? 'is-checked' : ''
                                                ].filter(Boolean).join(' ')}
                                                aria-pressed={!!item.checked}
                                                onClick={() => toggleItem(item.id)}
                                            >
                                                <span className="grocery-paper__box">
                                                    {item.checked && <GiCheckMark size={10} color="#e8e6e3" />}
                                                </span>
                                                <span className="grocery-paper__item">{item.text}</span>
                                            </button>
                                            <span className="grocery-paper__origin">Manual</span>
                                        </li>
                                    );
                                }

                                const ing = item.originalData;
                                return (
                                    <li key={ing.uniqueKey} className="grocery-paper__row">
                                        <span className="grocery-paper__box grocery-paper__box--planned" />
                                        <div>
                                            <span className="grocery-paper__item">{ing.amount} {ing.unit}</span> {ing.item}
                                            <div className="grocery-paper__origin">for {ing.recipeName}</div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroceryList;
