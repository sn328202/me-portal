import React, { useState } from 'react';
import { useProvisions } from '../hooks/useProvisions';
import { useIngredients } from '../hooks/useIngredients';
import { GiCheckMark, GiHouse, GiFiles } from 'react-icons/gi';
import { useTheme } from '../contexts/ThemeContext';
import WidgetCard from '../components/WidgetCard';
import WidgetLoading from '../components/WidgetLoading';
import EmptyState from '../components/EmptyState';
import Button from '../components/ui/Button';
import '../styles/ProvisionsWidget.css';

const ProvisionsWidget = ({ plan, recipes }) => {
    const { items, addItem, toggleItem, deleteItem, clearChecked, loading } = useProvisions();
    const { matcher, pantryStock } = useIngredients();
    const { getLabel, getIcon } = useTheme();
    const [input, setInput] = useState('');
    const [isCopied, setIsCopied] = useState(false);

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
                    // The shopping list is the place a bad match hurts most:
                    // an unmatched line becomes a second entry for something
                    // already in the cupboard, and she buys it twice.
                    const resolved = matcher.matchOne(ing.item || '');
                    const match = resolved.item;
                    const lowerName = resolved.normalised || (ing.item || '').toLowerCase().trim();

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

    const handleCopy = () => {
        let text = `${getLabel('provisions').toUpperCase()} LIST\n\n`;

        // 1. Provisions (exclude checked)
        const neededItems = items.filter(i => !i.checked);
        if (neededItems.length > 0) {
            text += `${getLabel('provisions').toUpperCase()}:\n`;
            neededItems.forEach(item => {
                text += `- [ ] ${item.text}\n`;
            });
            text += "\n";
        }

        // 2. Ingredients (exclude inStock)
        const neededIngredients = plannedList.filter(i => !i.inStock);
        if (neededIngredients.length > 0) {
            text += `${getLabel('fromTheHearth').toUpperCase()}:\n`;
            neededIngredients.forEach(ing => {
                const amount = ing.amount > 0 ? `${ing.amount} ${ing.unit} ` : '';
                text += `- [ ] ${amount}${ing.label}\n`;
            });
        }

        navigator.clipboard.writeText(text).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };


    const headerActions = (
        <>
            <Button
                size="sm"
                variant="ghost"
                className={isCopied ? 'provisions-copied' : ''}
                onClick={handleCopy}
                label="Copy list to clipboard"
            >
                {isCopied ? <GiCheckMark /> : <GiFiles />} {isCopied ? 'Copied' : 'Copy'}
            </Button>
            {items.some(i => i.checked) && (
                <Button size="sm" variant="ghost" onClick={clearChecked} label="Clear bought items">
                    Clear
                </Button>
            )}
        </>
    );

    return (
        <WidgetCard
            title={getLabel('provisions')}
            icon={getIcon('provisions')}
            actions={headerActions}
            scroll="tall"
        >
            {loading ? (
                <WidgetLoading />
            ) : (
                <>
                    <form onSubmit={handleSubmit} className="provisions-form">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Add item..."
                            aria-label="Add provision"
                            className="input provisions-input"
                        />
                    </form>

                    <div className="provisions-list-container">
                        {items.length === 0 && plannedList.length === 0 && (
                            <EmptyState
                                message={getLabel('larderEmpty')}
                                icon={getIcon('provisions')}
                            />
                        )}

                        <ul className="provisions-list">
                            {/* Manual Items */}
                            {items.map(item => (
                                <li key={item.id} className="provisions-item">
                                    <button
                                        type="button"
                                        onClick={() => toggleItem(item.id)}
                                        className={`provisions-item-content ${item.checked ? 'checked' : ''}`}
                                        aria-pressed={!!item.checked}
                                    >
                                        <span className={`provisions-checkbox ${item.checked ? 'checked' : ''}`}>
                                            {item.checked && <GiCheckMark size={10} color="var(--bg-main)" />}
                                        </span>
                                        <span className={`provisions-text ${item.checked ? 'checked' : ''}`}>{item.text}</span>
                                    </button>
                                    <Button
                                        icon
                                        size="sm"
                                        className="provisions-delete-btn"
                                        onClick={() => deleteItem(item.id)}
                                        label={`Discard "${item.text}"`}
                                    >
                                        &times;
                                    </Button>
                                </li>
                            ))}

                            {/* Planned Ingredients Separator */}
                            {plannedList.length > 0 && (
                                <>
                                    <li className="provisions-separator">
                                        {getLabel('fromTheHearth')}
                                    </li>
                                    {plannedList.map(ing => (
                                        <li key={ing.key} className={`provisions-planned-item ${ing.inStock ? 'in-stock' : ''}`}>
                                            <div className="provisions-planned-content">
                                                {ing.Icon && <span className="provisions-icon">{ing.Icon}</span>}
                                                <span className="provisions-amount">{ing.amount > 0 ? ing.amount : ''} {ing.unit}</span>
                                                <span>{ing.label}</span>
                                            </div>
                                            {ing.inStock && (
                                                <span className="provisions-stock-badge">
                                                    <GiHouse /> In Pantry
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </>
                            )}
                        </ul>
                    </div>
                </>
            )}
        </WidgetCard>
    );
};

export default ProvisionsWidget;
