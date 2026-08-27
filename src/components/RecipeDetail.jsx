import React, { useMemo, useState } from 'react';
import {
    GiKnifeFork, GiClockwork, GiFire, GiCheckMark,
    GiCancel, GiCookingPot, GiQuill, GiWorld, GiBasket, GiLinkedRings
} from 'react-icons/gi';
import { Button, Card, Stat, Tag } from './ui';
import IngredientLink from './IngredientLink';
import MissingIngredients from './MissingIngredients';

const RecipeDetail = ({
    recipe, onClose, onEdit, onCook, matcher, ingredients, categories = [],
    onAddMissing, onTeachAlias,
}) => {
    const [reviewing, setReviewing] = useState(false);
    // A single line being turned into a new ingredient goes through the same
    // review sheet as a bulk add, so it also gets a category and a symbol.
    const [creating, setCreating] = useState(null);
    const [added, setAdded] = useState(0);

    /**
     * Every ingredient line, resolved against the pantry.
     *
     * This used to be an exact lowercase lookup, which meant a line had to name
     * a pantry row character for character to count. `matcher` normalises both
     * sides and falls back to head-noun matching, so "freshly ground black
     * pepper" reaches `black pepper` and "deggi mirch indian chilli powder"
     * reaches `red chilli powder`.
     */
    const matchData = useMemo(
        () => matcher.matchRecipe(recipe.ingredients || []),
        [recipe, matcher]
    );

    // Nothing is written here - the review sheet decides what actually goes in,
    // and where. Guessed categories were putting everything in `Pantry`.
    const handleConfirm = async (rows) => {
        const result = await onAddMissing?.(rows);
        setAdded(result?.added || 0);
        setReviewing(false);
    };

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
                        {matchData.outOfStock.length > 0 && (
                            <Tag>{matchData.outOfStock.length} out of stock</Tag>
                        )}
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
                        {matchData.lines.map((ing, i) => (
                            <li
                                key={i}
                                className={`recipe-detail__provision${ing.match ? '' : ' is-unknown'}`}
                            >
                                <span className="recipe-detail__provision-name">
                                    <span className="recipe-detail__check" aria-hidden={!ing.inStock}>
                                        {ing.inStock && <GiCheckMark />}
                                    </span>
                                    <span>
                                        <strong>{ing.amount} {ing.unit}</strong> {ing.item}
                                        {/* Shown only when the app made a judgement call, so an
                                            exact match stays quiet and a guess stays auditable. */}
                                        {ing.resolvedAs && (
                                            <button
                                                type="button"
                                                className="recipe-detail__resolved"
                                                title={`Matched to "${ing.resolvedAs}" in your pantry. Click to make it permanent.`}
                                                onClick={() => onTeachAlias?.(ing.match.id, ing.normalised)}
                                            >
                                                <GiLinkedRings /> {ing.resolvedAs}
                                            </button>
                                        )}
                                        {/* Three states, each said out loud. Only
                                            "in stock" used to be visible, so an
                                            ingredient the pantry knew but had run
                                            out of looked identical to one it had
                                            never heard of - and a freshly linked
                                            line looked like nothing had happened. */}
                                        {!ing.match && (
                                            <span className="recipe-detail__unknown">not in pantry</span>
                                        )}
                                        {ing.match && !ing.inStock && (
                                            <span className="recipe-detail__unknown">out of stock</span>
                                        )}
                                        {/* Every line can be pointed at the right
                                            ingredient by hand - an unmatched one
                                            linked, a wrongly-matched one corrected.
                                            The wording sticks for future recipes. */}
                                        <IngredientLink
                                            line={ing}
                                            matcher={matcher}
                                            ingredients={ingredients}
                                            onLink={onTeachAlias}
                                            onCreate={(raw) => setCreating(raw)}
                                        />
                                    </span>
                                    {ing.inStock && <span className="visually-hidden">(in stock)</span>}
                                </span>
                                {ing.notes && <span className="recipe-detail__note">({ing.notes})</span>}
                            </li>
                        ))}
                    </ul>

                    {matchData.missing.length > 0 && (
                        <Button
                            block
                            className="recipe-detail__add-missing"
                            onClick={() => setReviewing(true)}
                        >
                            <GiBasket />{' '}
                            Add {matchData.missing.length} missing to the pantry…
                        </Button>
                    )}
                    {added > 0 && matchData.missing.length === 0 && (
                        <p className="recipe-detail__added">
                            {added} added to your pantry, out of stock.
                        </p>
                    )}
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
            <MissingIngredients
                open={reviewing}
                lines={matchData.missing.map((l) => l.raw)}
                categories={categories}
                onCancel={() => setReviewing(false)}
                onConfirm={handleConfirm}
            />

            <MissingIngredients
                open={Boolean(creating)}
                lines={creating ? [creating] : []}
                categories={categories}
                onCancel={() => setCreating(null)}
                onConfirm={async (rows) => {
                    await onAddMissing?.(rows);
                    setCreating(null);
                }}
            />
        </Card>
    );
};

export default RecipeDetail;
