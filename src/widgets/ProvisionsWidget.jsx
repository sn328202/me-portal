import React, { useState } from 'react';
import { useProvisions } from '../hooks/useProvisions';
import { useIngredients } from '../hooks/useIngredients';
import { GiBasket, GiCheckMark, GiHouse } from 'react-icons/gi';

const ProvisionsWidget = ({ plan, recipes }) => {
    const { items, addItem, toggleItem, deleteItem, clearChecked } = useProvisions();
    const { ingredientsByName, pantryStock } = useIngredients();
    const [input, setInput] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        addItem(input);
        setInput('');
    };

    // Calculate Planned Ingredients with Aggregation
    const aggregatedIngredients = {};

    if (plan && recipes) {
        Object.values(plan).flat().forEach(recipeId => {
            const recipe = recipes.find(r => r.id === recipeId);
            if (recipe) {
                recipe.ingredients.forEach(ing => {
                    // Normalize
                    const lowerName = ing.item.toLowerCase().trim();
                    const match = ingredientsByName ? ingredientsByName[lowerName] : null;

                    const key = match ? match.id : lowerName;
                    const label = match ? match.label : ing.item;
                    const Icon = match ? match.icon : null;
                    const unit = ing.unit || '';
                    const inStock = match ? !!pantryStock[match.id] : false;

                    // Group by Item + Unit (simple aggregation)
                    const uniqueKey = `${key}-${unit}`;

                    if (!aggregatedIngredients[uniqueKey]) {
                        aggregatedIngredients[uniqueKey] = {
                            key: uniqueKey,
                            label: label,
                            amount: 0,
                            unit: unit,
                            Icon: Icon,
                            inStock: inStock,
                            originalNames: new Set()
                        };
                    }

                    // Numeric Safety
                    const val = parseFloat(ing.amount);
                    if (!isNaN(val)) {
                        aggregatedIngredients[uniqueKey].amount += val;
                    }
                    aggregatedIngredients[uniqueKey].originalNames.add(ing.item);
                });
            }
        });
    }

    const plannedList = Object.values(aggregatedIngredients);
    // Sort: Needed items first, In Stock items last
    plannedList.sort((a, b) => {
        if (a.inStock === b.inStock) return 0;
        return a.inStock ? 1 : -1;
    });


    return (
        <div className="widget-card" style={{ height: '100%', padding: '1.5rem', background: '#d7cec7', border: '1px solid #795548', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #795548', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', color: '#3e2723', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <GiBasket /> Provisions
                </h3>
                {items.some(i => i.checked) && (
                    <button onClick={clearChecked} style={{ fontSize: '0.8rem', background: 'none', border: 'none', color: '#5d4037', cursor: 'pointer', textDecoration: 'underline' }}>
                        Clear Bought
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Add item..."
                    style={{ width: '100%', padding: '0.5rem', background: '#e8e4d9', border: '1px solid #a1887f', color: '#3e2723' }}
                />
            </form>

            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {items.length === 0 && plannedList.length === 0 && <div style={{ color: '#8d6e63', fontStyle: 'italic', textAlign: 'center' }}>The larder is empty.</div>}

                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {/* Manual Items */}
                    {items.map(item => (
                        <li key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <div
                                onClick={() => toggleItem(item.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', opacity: item.checked ? 0.5 : 1 }}
                            >
                                <div style={{
                                    width: '18px', height: '18px', border: '1px solid #5d4037',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: item.checked ? '#5d4037' : '#e8e4d9'
                                }}>
                                    {item.checked && <GiCheckMark size={10} color="#fff" />}
                                </div>
                                <span style={{ textDecoration: item.checked ? 'line-through' : 'none', color: '#3e2723' }}>{item.text}</span>
                            </div>
                        </li>
                    ))}

                    {/* Planned Ingredients Separator */}
                    {plannedList.length > 0 && (
                        <>
                            <li style={{
                                margin: '1rem 0 0.5rem 0',
                                fontSize: '0.75rem',
                                color: '#5d4037',
                                borderBottom: '1px solid #a1887f',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                From The Hearth
                            </li>
                            {plannedList.map(ing => (
                                <li key={ing.key} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginBottom: '0.5rem',
                                    paddingLeft: '0.5rem',
                                    borderLeft: ing.inStock ? '2px solid #5d4037' : '2px solid #a1887f',
                                    opacity: ing.inStock ? 0.6 : 1
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3e2723', flex: 1 }}>
                                        {ing.Icon && <span style={{ fontSize: '1.2rem' }}>{ing.Icon}</span>}
                                        <span style={{ fontWeight: 'bold' }}>{ing.amount > 0 ? ing.amount : ''} {ing.unit}</span>
                                        <span>{ing.label}</span>
                                    </div>
                                    {ing.inStock && (
                                        <span style={{ fontSize: '0.7rem', background: '#5d4037', color: '#e8e4d9', padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <GiHouse /> In Pantry
                                        </span>
                                    )}
                                </li>
                            ))}
                        </>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default ProvisionsWidget;
