import React, { useState, useMemo } from 'react';
import { GiCancel, GiCheckMark, GiFeather, GiFountainPen, GiScrollQuill, GiScrollUnfurled } from 'react-icons/gi';
import '../styles/MenuPrint.css';

const MenuView = ({ menu, recipes, onClose }) => {
    const [includeRecipes, setIncludeRecipes] = useState(false);

    // Group recipes by course
    const groupedRecipes = useMemo(() => {
        const grouped = {};
        menu.user_larder_menu_recipes?.forEach(mr => {
            const course = mr.course_name || 'General';
            if (!grouped[course]) grouped[course] = [];

            // Find full recipe data
            const fullRecipe = recipes.find(r => r.id === mr.recipe_id);
            if (fullRecipe) {
                grouped[course].push(fullRecipe);
            }
        });
        return grouped;
    }, [menu, recipes]);

    const handlePrint = () => {
        window.print();
    };

    const courses = ["Appetizer", "Starter", "Main Course", "Side", "Dessert", "Potable"];

    return (
        <div className="menu-view-container" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '40px 20px'
        }}>
            {/* Control Bar - Hidden in Print */}
            <div className="menu-actions" style={{
                maxWidth: '800px',
                margin: '0 auto 20px',
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 20px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-gold)',
                borderRadius: '4px'
            }}>
                <button onClick={onClose} style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GiCancel /> BACK TO ARCHIVE
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-gold)' }}>
                        <input
                            type="checkbox"
                            checked={includeRecipes}
                            onChange={e => setIncludeRecipes(e.target.checked)}
                            style={{ accentColor: 'var(--accent-gold)' }}
                        />
                        INCLUDE FULL RECIPES
                    </label>
                    <button onClick={handlePrint} style={{
                        background: 'var(--accent-gold)',
                        color: 'var(--bg-main)',
                        padding: '8px 20px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <GiScrollUnfurled /> PRINT / EXPORT
                    </button>
                </div>
            </div>

            {/* The actual Menu Card */}
            <div className="menu-paper" style={{
                maxWidth: '800px',
                margin: '0 auto',
                width: '100%',
                background: '#fdfbf7', // Parchment color for UI
                color: '#2a2620',
                padding: '40px 30px',
                minHeight: 'fit-content',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative'
            }}>
                {/* Decorative Borders */}
                <div className="no-print" style={{
                    position: 'absolute',
                    inset: '15px',
                    border: '1px solid rgba(138, 126, 87, 0.2)',
                    pointerEvents: 'none'
                }} />

                {/* Header */}
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ color: 'var(--border-gold)', fontSize: '1.5rem', marginBottom: '8px' }}>
                        <GiFountainPen />
                    </div>
                    <h1 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '2.8rem',
                        margin: '0 0 5px 0',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase'
                    }}>
                        {menu.title}
                    </h1>
                    {menu.occasion && (
                        <p style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1rem',
                            fontStyle: 'italic',
                            color: '#6e6456',
                            margin: 0
                        }}>
                            — {menu.occasion} —
                        </p>
                    )}
                </div>

                {/* Courses */}
                <div style={{ width: '100%', maxWidth: '600px' }}>
                    {courses.map(course => groupedRecipes[course] && (
                        <div key={course} className="course-section" style={{ marginBottom: '30px' }}>
                            <h2 style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: '0.9rem',
                                letterSpacing: '0.3em',
                                textTransform: 'uppercase',
                                color: '#8a7e57',
                                marginBottom: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px'
                            }}>
                                <span style={{ flex: 1, height: '1px', background: 'rgba(138, 126, 87, 0.2)' }}></span>
                                {course}
                                <span style={{ flex: 1, height: '1px', background: 'rgba(138, 126, 87, 0.2)' }}></span>
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {groupedRecipes[course].map(recipe => (
                                    <div key={recipe.id} className="recipe-item">
                                        <h3 style={{
                                            fontFamily: 'var(--font-display)',
                                            fontSize: '1.4rem',
                                            margin: '0 0 2px 0',
                                            color: '#2a2620'
                                        }}>
                                            {recipe.title}
                                        </h3>
                                        <div style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.65rem',
                                            color: '#8c857b',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em'
                                        }}>
                                            {recipe.tags?.join(' • ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{ marginTop: '30px', color: '#8a7e57', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    {menu.notes && <p style={{ fontStyle: 'italic', marginBottom: '15px' }}>"{menu.notes}"</p>}
                    <p style={{ letterSpacing: '0.2em' }}>THE LARDER • EST. 2026</p>
                </div>
            </div>

            {/* Full Recipe Pages (Optional) */}
            {includeRecipes && (
                <div style={{ maxWidth: '800px', margin: '40px auto 0', width: '100%' }}>
                    {Object.values(groupedRecipes).flat().map(recipe => (
                        <div key={recipe.id} className="recipe-page" style={{
                            background: '#fff',
                            color: '#1a1a1a',
                            padding: '60px',
                            marginBottom: '20px',
                            borderRadius: '2px',
                            boxShadow: '0 5px 15px rgba(0,0,0,0.3)'
                        }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                                {recipe.title}
                            </h2>

                            <div style={{ display: 'flex', gap: '40px', marginBottom: '30px', fontSize: '0.9rem' }}>
                                <div><strong>Prep:</strong> {recipe.prep_time}</div>
                                <div><strong>Cook:</strong> {recipe.cook_time}</div>
                                <div><strong>Yield:</strong> {recipe.servings}</div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '40px' }}>
                                <div>
                                    <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: '15px', color: '#8a7e57' }}>Provisions</h4>
                                    <ul className="provisions-list" style={{ listStyle: 'none', padding: 0 }}>
                                        {recipe.ingredients?.map((ing, i) => (
                                            <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem' }}>
                                                <strong>{ing.amount} {ing.unit}</strong> {ing.item}
                                                {ing.notes && <span style={{ color: '#888', fontStyle: 'italic', fontSize: '0.85rem' }}> ({ing.notes})</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: '15px', color: '#8a7e57' }}>Method</h4>
                                    <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '1rem' }}>
                                        {recipe.instructions}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MenuView;
