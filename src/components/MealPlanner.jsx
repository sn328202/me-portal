import React from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { GiEmptyHourglass, GiCookingPot, GiKnifeFork } from 'react-icons/gi';
import { Button, Card, EmptyState } from './ui';

const MealPlanner = ({ plan, recipes, onAddToDay, onClearDay }) => {
    // Generate Rolling 7 Days
    const today = startOfDay(new Date());
    const todayName = format(today, 'EEEE');
    const rollingDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i);
        return {
            dayName: format(date, 'EEEE'), // "Monday"
            label: format(date, 'EEEE, MMM d') // "Monday, Jan 29"
        };
    });

    // Helper to get recipe details
    const getRecipe = (id) => recipes.find(r => r.id === id);

    return (
        <div className="plan-grid">
            {rollingDays.map(({ dayName, label }) => {
                const dayPlan = plan[dayName] || [];
                const isToday = dayName === todayName;

                return (
                    <Card
                        key={dayName}
                        title={label}
                        className={['plan-day', isToday ? 'plan-day--today' : ''].filter(Boolean).join(' ')}
                        actions={dayPlan.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => onClearDay(dayName)}>
                                Clear
                            </Button>
                        )}
                    >
                        {dayPlan.length === 0 ? (
                            <EmptyState
                                icon={<GiEmptyHourglass />}
                                message="No sustenance planned."
                                actionLabel="Add a Formula"
                                onAction={() => onAddToDay(dayName)}
                            />
                        ) : (
                            <div className="plan-day__body">
                                <div className="plan-day__list">
                                    {dayPlan.map((recipeId, index) => {
                                        const recipe = getRecipe(recipeId);
                                        if (!recipe) return null;
                                        return (
                                            <div key={`${dayName}-${index}`} className="plan-day__item">
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
                                    onClick={() => onAddToDay(dayName)}
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
