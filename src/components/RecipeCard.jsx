import React, { useState } from 'react';
import { GiCookingPot } from 'react-icons/gi';
import { BsThreeDots } from 'react-icons/bs';
import { Button, Card, ConfirmButton, Tag } from './ui';
import RecipeCover from './RecipeCover';

const matchTone = (percentage) => {
    if (percentage === 100) return 'green';
    if (percentage >= 70) return 'gold';
    return 'default';
};

const RecipeCard = ({ recipe, matcher, onEdit, onDelete, onAddToPlan, onView }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <Card
            as="article"
            interactive
            className="recipe-card"
            onClick={() => onView(recipe)}
        >
            <div className="recipe-card__head">
                <div className="recipe-card__heading">
                    <h3 className="recipe-card__title">
                        <button
                            type="button"
                            className="recipe-card__title-btn"
                            onClick={(e) => { e.stopPropagation(); onView(recipe); }}
                        >
                            {recipe.title}
                        </button>
                    </h3>
                    {recipe.percentage !== undefined && (
                        <Tag tone={matchTone(recipe.percentage)}>
                            {recipe.percentage}% Pantry Match
                        </Tag>
                    )}
                </div>

                <div className="recipe-card__menu" onClick={(e) => e.stopPropagation()}>
                    <Button
                        icon
                        size="sm"
                        label={`More actions for ${recipe.title}`}
                        aria-expanded={isMenuOpen}
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <BsThreeDots />
                    </Button>
                    {isMenuOpen && (
                        <div className="recipe-card__menu-panel">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { onEdit(recipe); setIsMenuOpen(false); }}
                            >
                                Edit
                            </Button>
                            <ConfirmButton
                                label="Delete"
                                confirmLabel="Confirm Erasure?"
                                onConfirm={() => { onDelete(recipe.id); setIsMenuOpen(false); }}
                            >
                                Delete
                            </ConfirmButton>
                        </div>
                    )}
                </div>
            </div>

            {recipe.tags && recipe.tags.length > 0 && (
                <div className="tag-list">
                    {recipe.tags.map((tag, index) => (
                        <Tag key={index}>{tag}</Tag>
                    ))}
                </div>
            )}

            {/* Replaces the first-three-ingredients preview. Three lines of
                "1 pcs olive oil" told you very little about a recipe and made
                every card look the same; the picture is what you actually
                recognise a dish by. The full list is one tap away. */}
            <RecipeCover recipe={recipe} matcher={matcher} />

            <Button
                variant="primary"
                block
                onClick={(e) => { e.stopPropagation(); onAddToPlan(recipe); }}
            >
                <GiCookingPot /> Add to Plan
            </Button>
        </Card>
    );
};

export default RecipeCard;
