import React, { useState, useMemo } from 'react';
import { useProvisions } from '../hooks/useProvisions'; // Shared state
import { useIngredients } from '../hooks/useIngredients';
import { findIngredient } from '../data/ingredients';
import { GiCheckMark, GiBasket } from 'react-icons/gi';

const GroceryList = ({ plan, recipes }) => {
    // 1. Shared Manual Items (from Dashboard)
    const { items: manualItems, addItem, toggleItem, deleteItem, clearChecked } = useProvisions();
    const { ingredientsByName } = useIngredients();
    const [newItemInput, setNewItemInput] = useState('');

    // 2. Aggregate Planned Ingredients (from Hearth)
    const plannedIngredients = [];
    if (plan && recipes) {
        Object.values(plan).flat().forEach(recipeId => {
            const recipe = recipes.find(r => r.id === recipeId);
            if (recipe) {
                recipe.ingredients.forEach(ing => {
                    const uniqueKey = `planned-${recipe.id}-${ing.id}`;
                    plannedIngredients.push({ ...ing, recipeName: recipe.title, uniqueKey, isPlanned: true });
                });
            }
        });
    }

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
            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontStyle: 'italic' }}>
                    "A list is but a promise to oneself."
                </p>
                <p>Plan meals in The Hearth or add items manually to generate your provisions list.</p>

                <form onSubmit={handleAddManual} style={{ marginTop: '2rem', maxWidth: '300px', margin: '2rem auto' }}>
                    <input
                        type="text"
                        value={newItemInput}
                        onChange={(e) => setNewItemInput(e.target.value)}
                        placeholder="Add manual item..."
                        style={{ padding: '0.5rem', background: 'transparent', border: '1px solid var(--border-gold)', color: 'var(--text-main)', width: '100%' }}
                    />
                </form>
            </div>
        );
    }

    return (
        <div className="grocery-paper" style={{
            background: '#e8e6e3', // Paper texture
            color: '#1a1a1a', // Ink color
            padding: 'var(--space-xl)',
            maxWidth: '600px',
            margin: '0 auto',
            boxShadow: 'var(--shadow-md)',
            position: 'relative',
            fontFamily: 'var(--font-mono)', // Typewriter
            minHeight: '600px',
            transform: 'rotate(-0.5deg)'
        }}>
            <h2 style={{
                textAlign: 'center',
                fontFamily: 'var(--font-display)',
                borderBottom: '2px solid #1a1a1a',
                paddingBottom: 'var(--space-md)',
                marginBottom: 'var(--space-lg)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px'
            }}>
                <GiBasket /> Provisions
                {manualItems.some(i => i.checked) && (
                    <button
                        onClick={clearChecked}
                        style={{ position: 'absolute', right: '2rem', fontSize: '0.7rem', textDecoration: 'underline', color: '#555', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    >
                        Clear Checked
                    </button>
                )}
            </h2>

            <form onSubmit={handleAddManual} style={{ marginBottom: '2rem', borderBottom: '1px dashed #aaa', paddingBottom: '1rem' }}>
                <input
                    type="text"
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    placeholder="🖊️ Scribble new item..."
                    style={{
                        width: '100%', padding: '0.5rem',
                        background: 'transparent', border: 'none',
                        fontFamily: 'var(--font-mono)', fontSize: '1.1rem',
                        color: '#1a1a1a', outline: 'none'
                    }}
                />
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {categoricalGroups.sortedCategories.map(cat => (
                    <div key={cat}>
                        <h4 style={{
                            margin: '0 0 0.5rem 0',
                            fontSize: '0.8rem',
                            letterSpacing: '2px',
                            color: '#666',
                            borderBottom: '1px solid #ccc',
                            paddingBottom: '4px'
                        }}>
                            {cat}
                        </h4>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {categoricalGroups.groups[cat].map((item, idx) => {
                                if (item.type === 'manual') {
                                    return (
                                        <li key={item.id}
                                            onClick={() => toggleItem(item.id)}
                                            style={{
                                                display: 'flex', alignItems: 'baseline', gap: '12px', padding: '8px 0', borderBottom: '1px dashed #ccc',
                                                cursor: 'pointer', opacity: item.checked ? 0.5 : 1, textDecoration: item.checked ? 'line-through' : 'none'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', border: '1.5px solid #1a1a1a', borderRadius: '50%', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.checked ? '#1a1a1a' : 'transparent',
                                                marginTop: '2px'
                                            }}>
                                                {item.checked && <GiCheckMark size={10} color="#e8e6e3" />}
                                            </div>
                                            <span style={{ fontWeight: 'bold' }}>{item.text}</span>
                                            <div style={{ marginLeft: 'auto', fontSize: '0.6rem', color: '#888', fontStyle: 'italic' }}>Manual</div>
                                        </li>
                                    );
                                } else {
                                    const ing = item.originalData;
                                    return (
                                        <li key={ing.uniqueKey} style={{
                                            display: 'flex', alignItems: 'baseline', gap: '12px', padding: '8px 0', borderBottom: '1px dashed #ccc'
                                        }}>
                                            <div style={{ width: '18px', height: '18px', border: '1.5px solid #aaa', borderRadius: '50%', flexShrink: 0, marginTop: '2px' }} />
                                            <div>
                                                <span style={{ fontWeight: 'bold' }}>{ing.amount} {ing.unit}</span> {ing.item}
                                                <div style={{ fontSize: '0.6rem', color: '#888', fontStyle: 'italic' }}>for {ing.recipeName}</div>
                                            </div>
                                        </li>
                                    );
                                }
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroceryList;
