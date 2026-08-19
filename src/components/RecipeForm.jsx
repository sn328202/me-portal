import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { GiSave, GiCancel, GiTrashCan, GiCheckMark, GiWorld } from 'react-icons/gi';
import EmojiPicker from 'emoji-picker-react';
import { INGREDIENT_LIBRARY } from '../data/ingredients';
import { Button, Card, Field, Modal, Tag } from './ui';

const CATEGORIES = ['Pantry', 'Produce', 'Dairy', 'Protein', 'Spices'];

const RecipeForm = ({ recipe, onSave, onCancel, ingredientsByName, onAddIngredientToPantry, onImport, allTags = [] }) => {
    const [title, setTitle] = useState('');
    const [instructions, setInstructions] = useState('');
    const [ingredients, setIngredients] = useState([]); // Array of { item, amount, unit, notes }
    const [tags, setTags] = useState([]);

    const [suggestions, setSuggestions] = useState([]);
    const [activeIngIndex, setActiveIngIndex] = useState(null);

    // New Fields
    const [imageUrl, setImageUrl] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [servings, setServings] = useState('');
    const [prepTime, setPrepTime] = useState('');
    const [cookTime, setCookTime] = useState('');
    const [totalTime, setTotalTime] = useState('');

    const [newIngModal, setNewIngModal] = useState({ open: false, index: null, name: '', icon: '🍽️', category: 'Pantry', showPicker: false });
    const [importUrl, setImportUrl] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState('');

    // Check if ingredient exists in pantry
    const isIngredientUnknown = (name) => {
        if (!name || !ingredientsByName) return false;
        const key = name.toLowerCase().trim();
        return !ingredientsByName[key];
    };

    const handleImport = async () => {
        if (!importUrl || !onImport) return;
        setIsImporting(true);
        setImportError('');
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
            setImportError('Failed to transcribe from the aether: ' + e.message);
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

    const closeIngModal = () => setNewIngModal({ open: false, index: null, name: '', icon: '🍽️', category: 'Pantry', showPicker: false });

    const inscribeIngredient = () => {
        onAddIngredientToPantry(newIngModal.name.toLowerCase(), {
            label: newIngModal.name,
            icon: newIngModal.icon,
            category: newIngModal.category,
            defaultUnit: 'pcs'
        });
        closeIngModal();
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
        <Card
            as="form"
            onSubmit={handleSubmit}
            className="recipe-form"
            title={recipe ? 'Edit Formula' : 'New Culinary Formula'}
        >
            {/* Import Section (Only for new recipes) */}
            {!recipe && (
                <div className="recipe-form__import">
                    <h4 className="recipe-form__import-title">
                        <GiWorld /> Import from Aether (Web)
                    </h4>
                    <div className="recipe-form__import-row">
                        <Field
                            label="Recipe URL"
                            type="text"
                            placeholder="Paste recipe URL here..."
                            value={importUrl}
                            error={importError}
                            onChange={(e) => setImportUrl(e.target.value)}
                        />
                        <Button
                            variant="solid"
                            onClick={handleImport}
                            disabled={isImporting || !importUrl}
                        >
                            {isImporting ? 'Transcribing...' : 'Import'}
                        </Button>
                    </div>
                </div>
            )}

            <Field
                className="recipe-form__title"
                label="Title"
                type="text"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Moonlight Soufflé"
                required
            />

            {/* Image & Metadata */}
            <div className="recipe-form__image-row">
                <Field
                    label="Image URL"
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                />
                {imageUrl && (
                    <div className="recipe-form__thumb">
                        <img src={imageUrl} alt="Preview" />
                    </div>
                )}
            </div>

            <Field
                label="Source URL"
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/original-recipe"
            />

            <div className="field-row">
                <Field
                    label="Yield"
                    type="text"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    placeholder="e.g. 4 people"
                />
                <Field
                    label="Prep Time"
                    type="text"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    placeholder="15m"
                />
                <Field
                    label="Cook Time"
                    type="text"
                    value={cookTime}
                    onChange={(e) => setCookTime(e.target.value)}
                    placeholder="1h"
                />
                <Field
                    label="Total Time"
                    type="text"
                    value={totalTime}
                    onChange={(e) => setTotalTime(e.target.value)}
                    placeholder="1h 15m"
                />
            </div>

            {/* Ingredients */}
            <fieldset className="recipe-form__section">
                <legend className="section-title">Ingredients</legend>
                <div className="recipe-form__ingredients">
                    {ingredients.map((ing, i) => (
                        <div key={ing.id || i} className="recipe-form__ing">
                            <div className="recipe-form__ing-row">
                                <Field
                                    label="Amount"
                                    placeholder="Amount"
                                    value={ing.amount}
                                    onChange={e => handleIngredientChange(i, 'amount', e.target.value)}
                                />
                                <Field
                                    label="Unit"
                                    placeholder="Unit"
                                    value={ing.unit}
                                    onChange={e => handleIngredientChange(i, 'unit', e.target.value)}
                                />
                                <div className="recipe-form__ing-item">
                                    <Field
                                        label="Item"
                                        placeholder="Item"
                                        value={ing.item}
                                        onChange={e => handleItemChange(i, e.target.value)}
                                        onFocus={() => setActiveIngIndex(i)}
                                        onBlur={() => setTimeout(() => setActiveIngIndex(null), 200)}
                                        autoComplete="off"
                                    />
                                    {activeIngIndex === i && suggestions.length > 0 && (
                                        <div className="recipe-form__suggestions">
                                            {suggestions.map(s => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    className="recipe-form__suggestion"
                                                    onClick={() => selectIngredient(i, s)}
                                                >
                                                    <span className="recipe-form__suggestion-icon">{s.icon}</span>
                                                    <span>{s.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <Field
                                    label="Notes"
                                    placeholder="Notes (e.g. diced)"
                                    value={ing.notes || ''}
                                    onChange={e => handleIngredientChange(i, 'notes', e.target.value)}
                                />
                                <Button
                                    icon
                                    label={`Remove ingredient ${i + 1}`}
                                    className="recipe-form__ing-remove"
                                    onClick={() => removeIngredient(i)}
                                >
                                    <GiTrashCan />
                                </Button>
                            </div>

                            {/* New Ingredient Warning/Action */}
                            {isIngredientUnknown(ing.item) && (
                                <div className="recipe-form__unknown">
                                    <Tag tone="gold">❓ UNREGISTERED PROVISION</Tag>
                                    <Button
                                        size="sm"
                                        onClick={() => setNewIngModal({
                                            open: true, index: i, name: ing.item,
                                            icon: '🍽️', category: 'Pantry', showPicker: false
                                        })}
                                    >
                                        CATALOGUE
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={addIngredient}>
                        + Add Component
                    </Button>
                </div>
            </fieldset>

            <Field
                as="textarea"
                label="Method"
                name="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Describe the ritual..."
            />

            {/* Tags - Standardized Selection */}
            <div className="recipe-form__tags">
                {tags.length > 0 && (
                    <div className="tag-list">
                        {tags.map(tag => (
                            <Tag key={tag} tone="gold">
                                {tag}
                                <button
                                    type="button"
                                    className="tag__remove"
                                    aria-label={`Remove tag ${tag}`}
                                    onClick={() => setTags(tags.filter(t => t !== tag))}
                                >
                                    ×
                                </button>
                            </Tag>
                        ))}
                    </div>
                )}

                <TagSelector
                    existingTags={tags}
                    allRecipeSourceTags={allTags}
                    onAddTag={(tag) => setTags([...tags, tag])}
                />
            </div>

            {/* Actions */}
            <div className="recipe-form__actions">
                <Button variant="ghost" onClick={onCancel}>
                    <GiCancel /> Cancel
                </Button>
                <Button variant="solid" type="submit">
                    <GiSave /> Save
                </Button>
            </div>

            {/* New Ingredient Modal */}
            <Modal
                open={newIngModal.open}
                onClose={closeIngModal}
                title="Catalog Provision"
                footer={(
                    <>
                        <Button variant="ghost" onClick={closeIngModal}>Discard</Button>
                        <Button variant="solid" onClick={inscribeIngredient}>
                            <GiCheckMark /> Inscribe
                        </Button>
                    </>
                )}
            >
                <Field
                    label="ITEM NAME"
                    value={newIngModal.name}
                    onChange={e => setNewIngModal(p => ({ ...p, name: e.target.value }))}
                />

                <div className="recipe-form__catalog-row">
                    <Field label="CLASSIFICATION">
                        <select
                            className="select"
                            value={newIngModal.category}
                            onChange={e => setNewIngModal(p => ({ ...p, category: e.target.value }))}
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </Field>
                    <div className="field recipe-form__symbol">
                        <span className="field__label" id="provision-symbol-label">SYMBOL</span>
                        <Button
                            className="recipe-form__symbol-btn"
                            label="Choose ingredient symbol"
                            aria-describedby="provision-symbol-label"
                            aria-expanded={!!newIngModal.showPicker}
                            onClick={() => setNewIngModal(p => ({ ...p, showPicker: !p.showPicker }))}
                        >
                            {newIngModal.icon}
                        </Button>
                        {newIngModal.showPicker && (
                            <div className="recipe-form__symbol-picker">
                                <EmojiPicker
                                    theme="dark"
                                    width={300}
                                    onEmojiClick={(d) => setNewIngModal(p => ({ ...p, icon: d.emoji, showPicker: false }))}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </Card>
    );
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
        const fetchTags = async () => {
            const { data } = await supabase
                .from('recipe_tags')
                .select('name')
                .eq('user_id', user.id);
            if (data) setDbTags(data.map(t => t.name));
        };
        if (user) fetchTags();
    }, [user]);

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
        <div className="recipe-form__tag-input">
            <Field
                label="Tags"
                type="text"
                value={input}
                onChange={handleInput}
                onFocus={() => input && setIsOpen(true)}
                placeholder="Search or Create Tag..."
                autoComplete="off"
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
                <div className="recipe-form__suggestions recipe-form__suggestions--tags">
                    {suggestions.map(tag => (
                        <button
                            key={tag}
                            type="button"
                            className="recipe-form__suggestion"
                            onClick={() => { onAddTag(tag); setInput(''); setIsOpen(false); }}
                        >
                            {tag}
                        </button>
                    ))}
                    {input && !allRecipeSourceTags.some(t => t.toLowerCase() === input.toLowerCase()) && (
                        <button
                            type="button"
                            className="recipe-form__suggestion recipe-form__suggestion--create"
                            onClick={createTag}
                        >
                            + Create "{input}"
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default RecipeForm;
