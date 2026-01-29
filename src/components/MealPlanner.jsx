import React from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { GiEmptyHourglass, GiCookingPot } from 'react-icons/gi';

const MealPlanner = ({ plan, recipes, onUpdatePlan, onClearDay }) => {
    // Generate Rolling 7 Days
    const today = startOfDay(new Date());
    const rollingDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i);
        return {
            date,
            dayName: format(date, 'EEEE'), // "Monday"
            label: format(date, 'EEEE, MMM d') // "Monday, Jan 29"
        };
    });

    // Helper to get recipe details
    const getRecipe = (id) => recipes.find(r => r.id === id);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
            {rollingDays.map(({ dayName, label, date }, i) => {
                const dayPlan = plan[dayName] || [];

                return (
                    <div key={dayName} style={{
                        background: 'var(--bg-panel)',
                        border: 'var(--border-double)',
                        padding: 'var(--space-md)',
                        minHeight: '150px',
                        outline: dayName === format(today, 'EEEE') ? '2px solid var(--accent-gold)' : 'none'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--space-sm)',
                            borderBottom: '1px solid var(--border-gold)',
                            paddingBottom: '4px'
                        }}>
                            <h3 className="box-header" style={{ margin: 0, textTransform: 'uppercase', fontSize: '1rem' }}>
                                {label}
                            </h3>
                            <button onClick={() => onClearDay(dayName)} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>Clear</button>
                        </div>

                        {dayPlan.length === 0 ? (
                            <div style={{
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                                fontSize: '0.9rem',
                                padding: 'var(--space-md)',
                                textAlign: 'center',
                                border: '1px dashed var(--border-dim)',
                                borderRadius: '4px'
                            }}>
                                <GiEmptyHourglass style={{ marginRight: '8px' }} />
                                No sustenance planned.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {dayPlan.map((recipeId, index) => {
                                    const recipe = getRecipe(recipeId);
                                    if (!recipe) return null;
                                    return (
                                        <div key={`${dayName}-${index}`} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px',
                                            background: 'var(--bg-hover)',
                                            borderLeft: '2px solid var(--accent-gold)'
                                        }}>
                                            <GiCookingPot style={{ color: 'var(--accent-gold)' }} />
                                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>{recipe.title}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default MealPlanner;
