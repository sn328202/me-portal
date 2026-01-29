import React, { useState } from 'react';
import { GiKnifeFork, GiCookingPot, GiCheckMark } from 'react-icons/gi';
import { BsThreeDots } from 'react-icons/bs';

const RecipeCard = ({ recipe, onEdit, onDelete, onAddToPlan, onView }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div style={{
            background: 'var(--bg-panel)',
            border: 'var(--border-double)',
            padding: 'var(--space-md)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-md)',
            height: '100%',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
        }}
            className="widget-card"
            onClick={() => onView(recipe)}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <h3 className="box-header" style={{
                        fontSize: '1.1rem',
                        textTransform: 'none',
                        margin: 0,
                        lineHeight: 1.4
                    }}>
                        {recipe.title}
                    </h3>

                    {/* Pantry Match Badge */}
                    {recipe.percentage !== undefined && (
                        <div style={{
                            marginTop: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: recipe.percentage === 100 ? 'rgba(76, 175, 80, 0.2)' :
                                recipe.percentage >= 70 ? 'rgba(255, 193, 7, 0.2)' : 'rgba(150, 150, 150, 0.2)',
                            color: recipe.percentage === 100 ? '#4caf50' :
                                recipe.percentage >= 70 ? '#ffc107' : 'var(--text-muted)',
                            border: `1px solid ${recipe.percentage === 100 ? '#4caf50' : recipe.percentage >= 70 ? '#ffc107' : 'var(--border-dim)'}`
                        }}>
                            {recipe.percentage}% Pantry Match
                        </div>
                    )}
                </div>

                <div style={{ position: 'relative' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                        style={{ color: 'var(--text-muted)', padding: '4px' }}
                    >
                        <BsThreeDots />
                    </button>
                    {isMenuOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border-gold)',
                            zIndex: 10,
                            minWidth: '120px',
                            boxShadow: 'var(--shadow-md)'
                        }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(recipe); setIsMenuOpen(false); }}
                                style={{ display: 'block', width: '100%', padding: '8px', textAlign: 'left', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                className="menu-item"
                            >
                                Edit
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(recipe.id); setIsMenuOpen(false); }}
                                style={{ display: 'block', width: '100%', padding: '8px', textAlign: 'left', color: 'var(--accent-crimson)', fontSize: '0.9rem' }}
                                className="menu-item"
                            >
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {recipe.tags && recipe.tags.map((tag, index) => (
                    <span key={index} style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        border: '1px solid var(--border-dim)',
                        borderRadius: '12px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        {tag}
                    </span>
                ))}
            </div>

            {/* Preview of ingredients (first 3) */}
            <div style={{
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                flex: 1,
                borderTop: '1px solid var(--border-dim)',
                paddingTop: 'var(--space-sm)',
                fontFamily: 'var(--font-body)'
            }}>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                    {recipe.ingredients && recipe.ingredients.slice(0, 3).map((ing, i) => (
                        <li key={i}>{ing.amount} {ing.unit} {ing.item}</li>
                    ))}
                    {recipe.ingredients && recipe.ingredients.length > 3 && (
                        <li style={{ listStyle: 'none', fontStyle: 'italic', marginTop: '4px' }}>
                            ...and {recipe.ingredients.length - 3} more
                        </li>
                    )}
                </ul>
            </div>

            {/* Actions */}
            <button
                onClick={(e) => { e.stopPropagation(); onAddToPlan(recipe); }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-gold)',
                    color: 'var(--text-gold)',
                    fontFamily: 'var(--font-display)',
                    textTransform: 'uppercase',
                    fontSize: '0.8rem',
                    letterSpacing: '1px',
                    marginTop: 'auto',
                    transition: 'all 0.2s'
                }}
                className="widget-btn"
            >
                <GiCookingPot /> Add to Plan
            </button>
        </div >
    );
};

export default RecipeCard;
