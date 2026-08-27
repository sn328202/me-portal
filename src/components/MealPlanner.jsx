import React from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { GiEmptyHourglass, GiCookingPot, GiKnifeFork } from 'react-icons/gi';
import { Button, Card, EmptyState } from './ui';

const MealPlanner = ({ plan, recipes, onAddToDay, onClearDay }) => {
    // A rolling seven days from today, each identified by its actual date.
    //
    // The grid always looked like this; what changed is what it looks *up*.
    // Keying on the weekday name meant Friday's dinner reappeared every Friday
    // for ever, because nothing distinguished this Friday from the next one.
    const today = startOfDay(new Date());
    const rollingDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i);
        return {
            iso: format(date, 'yyyy-MM-dd'),
            label: i === 0 ? `Today, ${format(date, 'MMM d')}`
                : i === 1 ? `Tomorrow, ${format(date, 'MMM d')}`
                    : format(date, 'EEEE, MMM d'),
            isToday: i === 0,
        };
    });

    // Helper to get recipe details
    const getRecipe = (id) => recipes.find(r => r.id === id);

    return (
        <div className="plan-grid">
            {rollingDays.map(({ iso, label, isToday }) => {
                const dayPlan = plan[iso] || [];

                return (
                    <Card
                        key={iso}
                        title={label}
                        className={['plan-day', isToday ? 'plan-day--today' : ''].filter(Boolean).join(' ')}
                        actions={dayPlan.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => onClearDay(iso)}>
                                Clear
                            </Button>
                        )}
                    >
                        {dayPlan.length === 0 ? (
                            <EmptyState
                                icon={<GiEmptyHourglass />}
                                message="No sustenance planned."
                                actionLabel="Add a Formula"
                                onAction={() => onAddToDay(iso)}
                            />
                        ) : (
                            <div className="plan-day__body">
                                <div className="plan-day__list">
                                    {dayPlan.map((recipeId, index) => {
                                        const recipe = getRecipe(recipeId);
                                        if (!recipe) return null;
                                        return (
                                            <div key={`${iso}-${index}`} className="plan-day__item">
                                                <span className="plan-day__item-icon"><GiCookingPot /></span>
                                                <span className="plan-day__item-title">{recipe.title}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    block
                                    onClick={() => onAddToDay(iso)}
                                >
                                    <GiKnifeFork /> Add a Formula
                                </Button>
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
};

export default MealPlanner;
