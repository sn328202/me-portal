import React from 'react';
import RecipeCard from './RecipeCard';
import { GiCauldron } from 'react-icons/gi';

const RecipeList = ({ recipes, onEdit, onDelete, onAddToPlan, onView }) => {
    if (recipes.length === 0) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '300px',
                color: 'var(--text-muted)',
                border: '1px dashed var(--border-dim)',
                borderRadius: 'var(--radius-md)'
            }}>
                <GiCauldron size={48} style={{ marginBottom: 'var(--space-md)', opacity: 0.5 }} />
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem' }}>The Larder is empty.</p>
                <p>Add a new formula to begin.</p>
            </div>
        );
    }

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--space-lg)'
        }}>
            {recipes.map(recipe => (
                <RecipeCard
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
