import React, { useMemo } from 'react';
import { GiKnifeFork, GiClockwork, GiFire, GiCheckMark, GiCancel, GiCookingPot, GiQuill, GiWorld } from 'react-icons/gi';

const RecipeDetail = ({ recipe, onClose, onEdit, onCook, ingredientsByName }) => {

    // Calculate Pantry Match
    const matchData = useMemo(() => {
        if (!recipe.ingredients || recipe.ingredients.length === 0) return { percent: 0, matches: [] };

        const matches = recipe.ingredients.map(ing => {
            const cleanName = ing.item.toLowerCase().trim();
            // Check by name
            const pantryItem = ingredientsByName[cleanName];
            const inStock = pantryItem && pantryItem.in_stock;
            return { ...ing, inStock };
        });

        const stockCount = matches.filter(m => m.inStock).length;
        const percent = Math.round((stockCount / matches.length) * 100);

        return { percent, matches };
    }, [recipe, ingredientsByName]);

    // Better Match Logic:
    // We render the list. The user can visually check. 
    // Automating "Do I have 'large eggs'?" when I have "Eggs" is hard without fuzzy logic.
    // Let's just list them nicely.

    const formatTime = (iso) => {
        if (!iso) return '-';
        return iso; // Already formatted in hook usually (1h 30m)
    };

    return (
        <div style={{
            background: 'var(--bg-panel)',
            border: 'var(--border-double)',
            padding: '2rem',
            maxWidth: '900px',
            margin: '0 auto',
            position: 'relative',
            color: 'var(--text-main)',
            fontFamily: 'var(--font-body)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: '2.5rem', color: 'var(--text-gold)', lineHeight: 1.2 }}>
                    {recipe.title}
                </h1>
                {recipe.source_url && (
                    <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline', marginTop: '0.5rem' }}>
                        <GiWorld /> Original Formula ({(() => {
                            try {
                                return new URL(recipe.source_url).hostname;
                            } catch {
                                return 'External Link';
                            }
                        })()})
                    </a>
                )}
                <div style={{ marginLeft: '1rem', padding: '4px 8px', background: 'var(--bg-main)', border: '1px solid var(--accent-gold)', borderRadius: '4px', color: 'var(--text-gold)', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
                    Pantry Match: {matchData.percent}%
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={onEdit} style={btnStyle}>
                        <GiQuill /> Edit
                    </button>
                    <button onClick={onClose} style={{ ...btnStyle, color: 'var(--accent-crimson)', borderColor: 'var(--accent-crimson)' }}>
                        <GiCancel /> Close
                    </button>
                </div>
            </div>

            {/* Metadata Grid */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '1rem', marginBottom: '2rem',
                borderTop: '1px solid var(--border-gold)', borderBottom: '1px solid var(--border-gold)',
                padding: '1rem 0'
            }}>
                <Stat icon={<GiKnifeFork />} label="Servings" value={recipe.servings} />
                <Stat icon={<GiClockwork />} label="Prep" value={recipe.prep_time} />
                <Stat icon={<GiFire />} label="Cook" value={recipe.cook_time} />
                <Stat icon={<GiCheckMark />} label="Total" value={recipe.total_time} />
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Ingredients Column */}
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-gold)', borderBottom: '1px dashed var(--text-muted)' }}>Provisions</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {matchData.matches.map((ing, i) => (
                            <li key={i} style={{
                                padding: '8px 0',
                                borderBottom: '1px solid var(--border-dim)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {ing.inStock ?
                                        <GiCheckMark style={{ color: 'var(--accent-gold)' }} /> :
                                        <span style={{ width: '16px' }}></span>
                                    }
                                    <span style={{ opacity: ing.inStock ? 1 : 0.7 }}>
                                        <strong>{ing.amount} {ing.unit}</strong> {ing.item}
                                    </span>
                                </span>
                                {ing.notes && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>({ing.notes})</span>}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Instructions Column & Image */}
                <div style={{ flex: 1.5, minWidth: '300px' }}>
                    {recipe.image_url && (
                        <div style={{
                            width: '100%', height: '300px', marginBottom: '2rem',
                            borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-gold)'
                        }}>
                            <img src={recipe.image_url} alt={recipe.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    )}

                    <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-gold)', borderBottom: '1px dashed var(--text-muted)' }}>The Ritual</h3>
                    <div style={{ whiteSpace: 'pre-line', lineHeight: '1.8' }}>
                        {recipe.instructions}
                    </div>

                    <button onClick={onCook} style={{
                        marginTop: '3rem',
                        width: '100%',
                        padding: '1rem',
                        background: 'var(--accent-gold)',
                        color: 'var(--bg-main)',
                        border: '1px solid var(--border-gold)',
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
                        textTransform: 'uppercase'
                    }}>
                        <GiCookingPot size={32} /> Commence Cooking
                    </button>
                </div>
            </div>
        </div>
    );
};

const Stat = ({ icon, label, value }) => (
    <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', color: 'var(--text-gold)', marginBottom: '0.2rem' }}>{icon}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontWeight: 'bold' }}>{value || '-'}</div>
    </div>
);

const btnStyle = {
    background: 'transparent',
    border: '1px solid var(--border-dim)',
    color: 'var(--text-main)',
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    textTransform: 'uppercase'
};

export default RecipeDetail;
