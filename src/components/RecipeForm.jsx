import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { GiSave, GiCancel, GiTrashCan, GiCheckMark, GiWorld } from 'react-icons/gi';
import EmojiPicker from 'emoji-picker-react';
import { INGREDIENT_LIBRARY } from '../data/ingredients';


const RecipeForm = ({ recipe, onSave, onCancel, ingredientsByName, onAddIngredientToPantry, onImport, allTags = [] }) => {
    const [title, setTitle] = useState('');
    const [instructions, setInstructions] = useState('');
    const [ingredients, setIngredients] = useState([]); // Array of { item, amount, unit, notes }
    const [tags, setTags] = useState([]);

    const [tagInput, setTagInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [activeIngIndex, setActiveIngIndex] = useState(null);

    // New Fields
    const [imageUrl, setImageUrl] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [servings, setServings] = useState('');
    const [prepTime, setPrepTime] = useState('');
    const [cookTime, setCookTime] = useState('');
    const [totalTime, setTotalTime] = useState('');

    const [newIngModal, setNewIngModal] = useState({ open: false, index: null, name: '', icon: '🍽️', category: 'Pantry' });
    const [importUrl, setImportUrl] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    // Check if ingredient exists in pantry
    const isIngredientUnknown = (name) => {
        if (!name || !ingredientsByName) return false;
        const key = name.toLowerCase().trim();
        return !ingredientsByName[key];
    };

    const handleImport = async () => {
        if (!importUrl || !onImport) return;
        setIsImporting(true);
        try {
            const data = await onImport(importUrl);
            setTitle(data.title || '');
            setInstructions(data.instructions || '');
            setIngredients(data.ingredients || []);
            setTags(data.tags || ['Imported']);
            setImageUrl(data.image_url || '');
            setSourceUrl(data.source_url || importUrl); // Set source URL
            setServings(data.servings || '');
            setPrepTime(data.prep_time || '');
            setCookTime(data.cook_time || '');
            setTotalTime(data.total_time || '');
        } catch (e) {
            alert("Failed to transcribe from the aether: " + e.message);
        } finally {
            setIsImporting(false);
        }
    };

    const handleItemChange = (index, value) => {
        handleIngredientChange(index, 'item', value);
        if (!value) {
            setSuggestions([]);
            return;
        }
        const lower = value.toLowerCase();
        // Use pantry data for suggestions if available, else fallback/mix?
        // Let's use pantry first
        let matches = [];
        if (ingredientsByName) {
            matches = Object.values(ingredientsByName)
                .filter(i => i.label?.toLowerCase().includes(lower))
                .slice(0, 5);
        } else {
            matches = Object.keys(INGREDIENT_LIBRARY)
                .filter(key => key.includes(lower))
                .map(key => ({ id: key, ...INGREDIENT_LIBRARY[key] }));
        }
        setSuggestions(matches);
        setActiveIngIndex(index);
    };

    const selectIngredient = (index, ingData) => {
        handleIngredientChange(index, 'item', ingData.label); // Use nice label
        if (!ingredients[index].unit) {
            handleIngredientChange(index, 'unit', ingData.defaultUnit);
        }
        setSuggestions([]);
        setActiveIngIndex(null);
    };

    useEffect(() => {
        if (recipe) {
            setTitle(recipe.title || '');
            setInstructions(recipe.instructions || '');
            setIngredients(recipe.ingredients || []);
            setTags(recipe.tags || []);
            setImageUrl(recipe.image_url || '');
            setSourceUrl(recipe.source_url || '');
            setServings(recipe.servings || '');
            setPrepTime(recipe.prep_time || '');
            setCookTime(recipe.cook_time || '');
            setTotalTime(recipe.total_time || '');
        }
    }, [recipe]);

    const handleIngredientChange = (index, field, value) => {
        const newIngredients = [...ingredients];
        newIngredients[index] = { ...newIngredients[index], [field]: value };
        setIngredients(newIngredients);
    };

    const addIngredient = () => {
        setIngredients(prev => [...prev, { item: '', amount: '', unit: '', notes: '', id: Date.now() }]);
    };

    const removeIngredient = (index) => {
        const newIngredients = [...ingredients];
        newIngredients.splice(index, 1);
        setIngredients(newIngredients);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...recipe,
            title,
            instructions,
            ingredients,
            image_url: imageUrl,
            source_url: sourceUrl,
            servings,
            prep_time: prepTime,
            cook_time: cookTime,
            total_time: totalTime,
            tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)
        });
    };

    return (
        <form onSubmit={handleSubmit} style={{
            background: 'var(--bg-panel)',
            border: 'var(--border-double)',
            padding: 'var(--space-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-md)',
            maxWidth: '800px',
            margin: '0 auto'
        }}>

            {/* Import Section (Only for new recipes) */}
            {!recipe && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(207, 181, 59, 0.05)', border: '1px dashed var(--border-gold)', borderRadius: '4px' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-display)', color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <GiWorld /> Import from Aether (Web)
                    </h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            placeholder="Paste recipe URL here..."
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            style={{
                                flex: 1,
                                background: 'var(--bg-main)',
                                border: '1px solid var(--border-dim)',
                                color: 'var(--text-main)',
                                padding: '0.5rem',
                                fontFamily: 'var(--font-mono)'
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleImport}
                            disabled={isImporting || !importUrl}
                            style={{
                                background: 'var(--accent-gold)',
                                color: 'var(--bg-main)',
                                border: 'none',
                                padding: '0 1rem',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                opacity: isImporting ? 0.7 : 1
                            }}
                        >
                            {isImporting ? 'Transcribing...' : 'Import'}
                        </button>
                    </div>
                </div>
            )}

            <h2 className="box-header" style={{ borderBottom: '1px solid var(--border-gold)', paddingBottom: 'var(--space-sm)' }}>
                {recipe ? 'Edit Formula' : 'New Culinary Formula'}
            </h2>

            {/* Title */}
            <div>
                <label style={{ display: 'block', color: 'var(--text-gold)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>Title</label>
                <input
                    type="text"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border-gold)',
                        color: 'var(--text-main)',
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.5rem',
                        padding: '8px 0',
                        outline: 'none'
                    }}
                    placeholder="E.g., Moonlight Soufflé"
                    required
                />
            </div>

            {/* Image & Metadata */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', color: 'var(--text-gold)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>Image URL</label>
                    <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        style={{ ...inputStyle, width: '100%' }}
                        placeholder="https://..."
                    />
                </div>
                {imageUrl && (
                    <div style={{ width: '80px', height: '80px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-gold)' }}>
                        <img src={imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                )}
            </div>

            {/* Source URL */}
            <div>
                <label style={{ display: 'block', color: 'var(--text-gold)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>Source URL</label>
                <input
                    type="text"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                    placeholder="https://example.com/original-recipe"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                <div>
                    <label style={{ display: 'block', color: 'var(--text-gold)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>Yield</label>
                    <input
                        type="text"
                        value={servings}
                        onChange={(e) => setServings(e.target.value)}
                        style={{ ...inputStyle, width: '100%' }}
                        placeholder="e.g. 4 people"
                    />
                </div>
                <div>
                    <label style={{ display: 'block', color: 'var(--text-gold)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>Prep Time</label>
                    <input
                        type="text"
                        value={prepTime}
                        onChange={(e) => setPrepTime(e.target.value)}
                        style={{ ...inputStyle, width: '100%' }}
                        placeholder="15m"
                    />
                </div>
                <div>
                    <label style={{ display: 'block', color: 'var(--text-gold)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>Cook Time</label>
                    <input
                        type="text"
                        value={cookTime}
                        onChange={(e) => setCookTime(e.target.value)}
                        style={{ ...inputStyle, width: '100%' }}
                        placeholder="1h"
                    />
                </div>
                <div>
                    <label style={{ display: 'block', color: 'var(--text-gold)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>Total Time</label>
                    <input
                        type="text"
                        value={totalTime}
                        onChange={(e) => setTotalTime(e.target.value)}
                        style={{ ...inputStyle, width: '100%' }}
                        placeholder="1h 15m"
                    />
                </div>
            </div>

            {/* Ingredients */}
            <div>
                <label style={{ display: 'block', color: 'var(--text-gold)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>Ingredients</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ingredients.map((ing, i) => (
                        <div key={ing.id || i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    placeholder="Amount"
                                    value={ing.amount}
                                    onChange={e => handleIngredientChange(i, 'amount', e.target.value)}
                                    style={inputStyle}
                                />
                                <input
                                    placeholder="Unit"
                                    value={ing.unit}
                                    onChange={e => handleIngredientChange(i, 'unit', e.target.value)}
                                    style={inputStyle}
                                />
                                <div style={{ position: 'relative', flex: 1.5 }}>
                                    <input
                                        placeholder="Item"
                                        value={ing.item}
                                        onChange={e => handleItemChange(i, e.target.value)}
                                        onFocus={() => setActiveIngIndex(i)}
                                        onBlur={() => setTimeout(() => setActiveIngIndex(null), 200)}
                                        style={{ ...inputStyle, width: '100%' }}
                                    />
                                    {activeIngIndex === i && suggestions.length > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            background: 'var(--bg-panel)',
                                            border: '1px solid var(--border-gold)',
                                            zIndex: 10,
                                            maxHeight: '150px',
                                            overflowY: 'auto',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                                        }}>
                                            {suggestions.map(s => (
                                                <div
                                                    key={s.id}
                                                    onClick={() => selectIngredient(i, s)}
                                                    style={{
                                                        padding: '8px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        borderBottom: '1px solid var(--border-dim)'
                                                    }}
                                                    className="hover-bg-dim"
                                                >
                                                    <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                                                    <span>{s.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <input
                                    placeholder="Notes (e.g. diced)"
                                    value={ing.notes || ''}
                                    onChange={e => handleIngredientChange(i, 'notes', e.target.value)}
                                    style={{ ...inputStyle, flex: 1, fontStyle: 'italic', color: 'var(--text-muted)' }}
                                />
                                <button type="button" onClick={() => removeIngredient(i)} aria-label={`Remove ingredient ${i + 1}`} style={{ color: 'var(--accent-crimson)' }}>
                                    <GiTrashCan />
                                </button>
                            </div>

                            {/* New Ingredient Warning/Action */}
                            {isIngredientUnknown(ing.item) && (
                                <div style={{
                                    marginLeft: '120px',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: 'rgba(207, 181, 59, 0.15)',
                                    border: '1px solid var(--border-gold)',
                                    padding: '4px 12px',
                                    borderRadius: '2px', // Vintage tag style
                                    alignSelf: 'flex-start',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-gold)', letterSpacing: '0.05em' }}>❓ UNREGISTERED PROVISION</span>
                                    <button
                                        type="button"
                                        onClick={() => setNewIngModal({ open: true, index: i, name: ing.item, icon: '🍽️', category: 'Pantry' })}
                                        style={{
                                            background: 'transparent',
                                            color: 'var(--accent-gold)',
                                            border: '1px solid var(--accent-gold)',
                                            fontSize: '0.7rem',
                                            padding: '2px 8px',
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-display)',
                                            letterSpacing: '0.1em',
                                            marginLeft: '8px',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => { e.target.style.background = 'var(--accent-gold)'; e.target.style.color = 'var(--bg-main)'; }}
                                        onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--accent-gold)'; }}
                                    >
                                        CATALOGUE
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addIngredient}
                        style={{
                            alignSelf: 'flex-start',
                            color: 'var(--text-muted)',
                            fontSize: '0.8rem',
                            marginTop: '4px',
                            fontFamily: 'var(--font-mono)',
                            borderBottom: '1px dashed var(--text-muted)'
                        }}
                    >
                        + Add Component
                    </button>
                </div>
            </div>

            {/* Instructions */}
            <div>
                <label style={{ display: 'block', color: 'var(--text-gold)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>Method</label>
                <textarea
                    name="instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    style={{
                        width: '100%',
                        minHeight: '150px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-dim)',
                        color: 'var(--text-main)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '1rem',
                        padding: '12px',
                        lineHeight: '1.6',
                        resize: 'vertical'
                    }}
                    placeholder="Describe the ritual..."
                />
            </div>

            {/* Tags - Standardized Selection */}
            <div>
                <label style={{ display: 'block', color: 'var(--text-gold)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>Tags</label>

                {/* Selected Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    {tags.map(tag => (
                        <div key={tag} style={{
                            background: 'var(--accent-gold)',
                            color: 'var(--bg-main)',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontFamily: 'var(--font-display)',
                            textTransform: 'uppercase',
                            fontWeight: 'bold'
                        }}>
                            {tag}
                            <span
                                onClick={() => setTags(tags.filter(t => t !== tag))}
                                style={{ cursor: 'pointer', fontSize: '1.1rem', opacity: 0.8 }}
                            >
                                ×
                            </span>
                        </div>
                    ))}
                </div>

                {/* Tag Input & Suggestions */}
                <TagSelector
                    existingTags={tags}
                    allRecipeSourceTags={allTags}
                    onAddTag={(tag) => setTags([...tags, tag])}
                />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        border: '1px solid var(--border-dim)',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-display)',
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                    }}
                >
                    <GiCancel /> Cancel
                </button>
                <button
                    type="submit"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 24px',
                        border: '1px solid var(--border-gold)',
                        background: 'var(--accent-gold)',
                        color: 'var(--bg-main)',
                        fontFamily: 'var(--font-display)',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                    }}
                >
                    <GiSave /> Save
                </button>
            </div>
            {/* New Ingredient Modal */}
            {newIngModal.open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 1000,
                    backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--bg-panel)',
                        border: 'var(--border-double)',
                        padding: '2.5rem',
                        width: '450px',
                        display: 'flex', flexDirection: 'column', gap: '1.5rem',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                        position: 'relative'
                    }}>
                        <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', bottom: '10px', border: '1px solid var(--border-dim)', pointerEvents: 'none' }} />

                        <h3 className="box-header" style={{
                            fontFamily: 'var(--font-display)',
                            color: 'var(--text-gold)',
                            margin: 0,
                            borderBottom: '1px solid var(--border-gold)',
                            paddingBottom: '1rem',
                            textAlign: 'center',
                            fontSize: '1.8rem',
                            letterSpacing: '0.05em'
                        }}>
                            Catalog Provision
                        </h3>

                        <div>
                            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>ITEM NAME</label>
                            <input
                                value={newIngModal.name}
                                onChange={e => setNewIngModal(p => ({ ...p, name: e.target.value }))}
                                style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.2)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-gold)',
                                    padding: '12px',
                                    fontFamily: 'var(--font-display)',
                                    fontSize: '1.2rem',
                                    textAlign: 'center'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>CLASSIFICATION</label>
                                <select
                                    value={newIngModal.category}
                                    onChange={e => setNewIngModal(p => ({ ...p, category: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'var(--bg-main)',
                                        color: 'var(--text-main)',
                                        border: '1px solid var(--border-dim)',
                                        padding: '12px',
                                        fontFamily: 'var(--font-body)'
                                    }}
                                >
                                    <option value="Pantry">Pantry</option>
                                    <option value="Produce">Produce</option>
                                    <option value="Dairy">Dairy</option>
                                    <option value="Protein">Protein</option>
                                    <option value="Spices">Spices</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>SYMBOL</label>
                                <button
                                    type="button"
                                    onClick={() => setNewIngModal(p => ({ ...p, showPicker: !p.showPicker }))}
                                    aria-label="Choose ingredient symbol"
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        background: 'var(--bg-main)',
                                        border: '1px solid var(--border-gold)',
                                        fontSize: '1.5rem',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    {newIngModal.icon}
                                </button>
                                {newIngModal.showPicker && (
                                    <div style={{ position: 'absolute', zIndex: 1100, transform: 'translateX(-50%)' }}>
                                        <EmojiPicker size={320} onEmojiClick={(d) => setNewIngModal(p => ({ ...p, icon: d.emoji, showPicker: false }))} theme="dark" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setNewIngModal({ open: false })}
                                style={{
                                    background: 'transparent',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-dim)',
                                    padding: '8px 20px',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-display)',
                                    textTransform: 'uppercase',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onAddIngredientToPantry(newIngModal.name.toLowerCase(), {
                                        label: newIngModal.name,
                                        icon: newIngModal.icon,
                                        category: newIngModal.category,
                                        defaultUnit: 'pcs'
                                    });
                                    setNewIngModal({ open: false });
                                }}
                                style={{
                                    background: 'var(--accent-gold)',
                                    color: 'var(--bg-main)',
                                    border: '1px solid var(--border-gold)',
                                    padding: '8px 24px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-display)',
                                    textTransform: 'uppercase',
                                    boxShadow: '0 4px 12px rgba(207, 181, 59, 0.3)'
                                }}
                            >
                                <GiCheckMark style={{ marginRight: '8px' }} /> Inscribe
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};

const inputStyle = {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-dim)',
    color: 'var(--text-main)',
    padding: '4px 8px',
    fontFamily: 'var(--font-body)',
    transition: 'border-color 0.2s',
    outline: 'none'
};

const TagSelector = ({ existingTags, onAddTag, allRecipeSourceTags = [] }) => {
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [dbTags, setDbTags] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();

    // Combined pool of tags from DB and currently loaded recipes
    const tagPool = Array.from(new Set([...dbTags, ...allRecipeSourceTags]));

    useEffect(() => {
        if (user) fetchTags();
    }, [user]);

    const fetchTags = async () => {
        const { data } = await supabase
            .from('recipe_tags')
            .select('name')
            .eq('user_id', user.id);
        if (data) setDbTags(data.map(t => t.name));
    };

    const handleInput = (e) => {
        const val = e.target.value;
        setInput(val);
        if (val.trim()) {
            setSuggestions(tagPool.filter(t =>
                t.toLowerCase().includes(val.toLowerCase()) &&
                !existingTags.includes(t)
            ));
            setIsOpen(true);
        } else {
            setSuggestions([]);
            setIsOpen(false);
        }
    };

    const createTag = async () => {
        const newTag = input.trim();
        if (!newTag) return;

        // Use upsert to handle "Conflict" gracefully
        // We still call onAddTag and setInput to make the UI responsive
        onAddTag(newTag);
        setInput('');
        setIsOpen(false);

        const { error } = await supabase
            .from('recipe_tags')
            .upsert({ name: newTag, user_id: user.id }, { onConflict: 'name, user_id' });

        if (!error && !dbTags.includes(newTag)) {
            setDbTags([...dbTags, newTag]);
        } else if (error) {
            console.error('Quiet error syncing tag:', error);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <input
                type="text"
                value={input}
                onChange={handleInput}
                onFocus={() => input && setIsOpen(true)}
                placeholder="Search or Create Tag..."
                style={{ ...inputStyle, width: '100%' }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (suggestions.length > 0) {
                            onAddTag(suggestions[0]);
                            setInput('');
                            setIsOpen(false);
                        } else {
                            createTag();
                        }
                    }
                }}
            />
            {isOpen && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'var(--bg-panel)', border: '1px solid var(--border-gold)',
                    zIndex: 20, maxHeight: '200px', overflowY: 'auto',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                }}>
                    {suggestions.map(tag => (
                        <div
                            key={tag}
                            onClick={() => { onAddTag(tag); setInput(''); setIsOpen(false); }}
                            style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid var(--border-dim)' }}
                            className="hover-effect"
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            {tag}
                        </div>
                    ))}
                    {input && !allRecipeSourceTags.some(t => t.toLowerCase() === input.toLowerCase()) && (
                        <div
                            onClick={createTag}
                            style={{ padding: '8px', cursor: 'pointer', color: 'var(--accent-gold)', borderTop: '1px dashed var(--border-gold)' }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            + Create "{input}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RecipeForm;
