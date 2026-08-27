import React from 'react';
import RecipeCard from './RecipeCard';
import { GiCauldron } from 'react-icons/gi';
import { EmptyState } from './ui';

const RecipeList = ({ recipes, matcher, onEdit, onDelete, onAddToPlan, onView, onCreate }) => {
    if (recipes.length === 0) {
        return (
            <EmptyState
                icon={<GiCauldron />}
                message="The Larder is empty."
                hint="Add a new formula to begin."
                actionLabel={onCreate ? 'New Formula' : undefined}
                onAction={onCreate}
            />
        );
    }

    return (
        <div className="larder-grid">
            {recipes.map(recipe => (
                <RecipeCard
                    matcher={matcher}
                    key={recipe.id}
                    recipe={recipe}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onAddToPlan={onAddToPlan}
                    onView={onView}
                />
            ))}
        </div>
    );
};

export default RecipeList;
