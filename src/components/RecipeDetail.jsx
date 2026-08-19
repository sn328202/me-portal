import React, { useMemo } from 'react';
import {
    GiKnifeFork, GiClockwork, GiFire, GiCheckMark,
    GiCancel, GiCookingPot, GiQuill, GiWorld
} from 'react-icons/gi';
import { Button, Card, Stat, Tag } from './ui';

const RecipeDetail = ({ recipe, onClose, onEdit, onCook, ingredientsByName }) => {

    // Calculate Pantry Match
    const matchData = useMemo(() => {
        if (!recipe.ingredients || recipe.ingredients.length === 0) return { percent: 0, matches: [] };

        const matches = recipe.ingredients.map(ing => {
            const cleanName = (ing.item || '').toLowerCase().trim();
            // Check by name
            const pantryItem = ingredientsByName[cleanName];
            const inStock = pantryItem && pantryItem.in_stock;
            return { ...ing, inStock };
        });

        const stockCount = matches.filter(m => m.inStock).length;
        const percent = Math.round((stockCount / matches.length) * 100);

        return { percent, matches };
    }, [recipe, ingredientsByName]);

    const sourceHost = (() => {
        if (!recipe.source_url) return null;
        try {
            return new URL(recipe.source_url).hostname;
        } catch {
            return 'External Link';
        }
    })();

    return (
        <Card className="recipe-detail">
            {/* Header */}
            <div className="recipe-detail__head">
                <div className="recipe-detail__identity">
                    <h1 className="recipe-detail__title">{recipe.title}</h1>
                    <div className="recipe-detail__meta">
                        <Tag tone="gold">Pantry Match: {matchData.percent}%</Tag>
                        {recipe.source_url && (
                            <a
                                className="recipe-detail__source"
                                href={recipe.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <GiWorld /> Original Formula ({sourceHost})
                            </a>
                        )}
                    </div>
                </div>
                <div className="recipe-detail__actions">
                    <Button onClick={onEdit}><GiQuill /> Edit</Button>
                    <Button variant="danger" onClick={onClose}><GiCancel /> Close</Button>
                </div>
            </div>

            {/* Metadata */}
            <div className="stat-row recipe-detail__stats">
                <Stat icon={<GiKnifeFork />} label="Servings" value={recipe.servings || '-'} />
                <Stat icon={<GiClockwork />} label="Prep" value={recipe.prep_time || '-'} />
                <Stat icon={<GiFire />} label="Cook" value={recipe.cook_time || '-'} />
                <Stat icon={<GiCheckMark />} label="Total" value={recipe.total_time || '-'} />
            </div>

            <div className="recipe-detail__columns">
                {/* Ingredients Column */}
                <div>
                    <h3 className="section-title">Provisions</h3>
                    <ul className="recipe-detail__provisions">
                        {matchData.matches.map((ing, i) => (
                            <li key={i} className="recipe-detail__provision">
                                <span className="recipe-detail__provision-name">
                                    <span className="recipe-detail__check" aria-hidden={!ing.inStock}>
                                        {ing.inStock && <GiCheckMark />}
                                    </span>
                                    <span>
                                        <strong>{ing.amount} {ing.unit}</strong> {ing.item}
                                    </span>
                                    {ing.inStock && <span className="visually-hidden">(in stock)</span>}
                                </span>
                                {ing.notes && <span className="recipe-detail__note">({ing.notes})</span>}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Instructions Column & Image */}
                <div className="recipe-detail__method-col">
                    {recipe.image_url && (
                        <div className="recipe-detail__image">
                            <img src={recipe.image_url} alt={recipe.title} />
                        </div>
                    )}

                    <h3 className="section-title">The Ritual</h3>
                    <div className="recipe-detail__method prose">
                        {recipe.instructions}
                    </div>

                    <Button variant="solid" block className="recipe-detail__cook" onClick={onCook}>
                        <GiCookingPot size={28} /> Commence Cooking
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default RecipeDetail;
