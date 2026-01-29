import React, { useState } from 'react';
import { useProvisions } from '../hooks/useProvisions'; // Shared state
import { GiCheckMark, GiBasket } from 'react-icons/gi';

const GroceryList = ({ plan, recipes }) => {
    // 1. Shared Manual Items (from Dashboard)
    const { items: manualItems, addItem, toggleItem, deleteItem, clearChecked } = useProvisions();
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

                {/* Allow adding manual item even in empty state */}
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
            transform: 'rotate(-1deg)'
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
                        style={{ position: 'absolute', right: '2rem', fontSize: '0.7rem', textDecoration: 'underline', color: '#555' }}
                    >
                        Clear Checked
                    </button>
                )}
            </h2>

            {/* Manual Entry Input (Paper Style) */}
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

            <ul style={{ listStyle: 'none', padding: 0 }}>
                {/* 1. Manual Items from Dashboard */}
                {manualItems.map(item => (
                    <li key={item.id}
                        onClick={() => toggleItem(item.id)}
                        style={{
                            display: 'flex', alignItems: 'baseline', gap: '12px', padding: '8px 0', borderBottom: '1px dashed #ccc',
                            cursor: 'pointer', opacity: item.checked ? 0.5 : 1, textDecoration: item.checked ? 'line-through' : 'none'
                        }}
                    >
                        <div style={{
                            width: '20px', height: '20px', border: '2px solid #1a1a1a', borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.checked ? '#1a1a1a' : 'transparent'
                        }}>
                            {item.checked && <GiCheckMark size={12} color="#e8e6e3" />}
                        </div>
                        <span style={{ fontWeight: 'bold' }}>{item.text}</span>
                        <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#666', fontStyle: 'italic' }}>(Manual)</div>
                    </li>
                ))}

                {/* 2. Planned Ingredients from Meal Plan */}
                {plannedIngredients.length > 0 && (
                    <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '2px double #ccc' }}>
                        <h4 style={{ margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem', color: '#555' }}>From The Hearth</h4>
                        {plannedIngredients.map(ing => (
                            <li key={ing.uniqueKey} style={{
                                display: 'flex', alignItems: 'baseline', gap: '12px', padding: '8px 0', borderBottom: '1px dashed #ccc'
                            }}>
                                <div style={{ width: '20px', height: '20px', border: '2px solid #aaa', borderRadius: '50%', flexShrink: 0 }} />
                                <div>
                                    <span style={{ fontWeight: 'bold' }}>{ing.amount} {ing.unit}</span> {ing.item}
                                    <div style={{ fontSize: '0.7rem', color: '#666', fontStyle: 'italic' }}>for {ing.recipeName}</div>
                                </div>
                            </li>
                        ))}
                    </div>
                )}
            </ul>
        </div>
    );
};

export default GroceryList;
