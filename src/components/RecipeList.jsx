import React from 'react';
import RecipeCard from './RecipeCard';
import { GiCauldron } from 'react-icons/gi';
import { EmptyState } from './ui';

const RecipeList = ({ recipes, matcher, onEdit, onDelete, onAddToPlan, onView, onCreate, searching }) => {
    if (recipes.length === 0) {
        /* Two different nothings. Searching for a word that matches no recipe
           used to be reported as "the Larder is empty", which is both untrue
           and unhelpful — the fix is to clear the search, not to write a
           recipe. */
        return searching ? (
            <EmptyState
                icon={<GiCauldron />}
                message="No recipes match that search."
                hint="Try a different word, or clear the search to see everything."
            />
        ) : (
            <EmptyState
                icon={<GiCauldron />}
                message="No recipes yet."
                hint="Add your first recipe, or import one from a link."
                actionLabel={onCreate ? 'New recipe' : undefined}
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
