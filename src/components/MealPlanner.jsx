import React, { useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { GiEmptyHourglass, GiCookingPot, GiKnifeFork, GiHourglass } from 'react-icons/gi';
import { Button, Card, EmptyState } from './ui';
import CookPlan from './CookPlan';
import { clockLabel } from '../../api/_cookPlan.js';

const MealPlanner = ({ plan, recipes, onAddToDay, onClearDay, dayPlans = {}, onSetServeTime, onSavePlan }) => {
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
            long: format(date, 'EEEE, d MMMM'),
            isToday: i === 0,
        };
    });

    // Which day's cooking schedule is open, if any.
    const [scheduling, setScheduling] = useState(null);

    // Helper to get recipe details
    const getRecipe = (id) => recipes.find(r => r.id === id);

    const open = scheduling ? rollingDays.find((d) => d.iso === scheduling) : null;
    const openRow = open ? dayPlans[open.iso] : null;
    const openDishes = open ? (plan[open.iso] || []).filter((id) => getRecipe(id)).length : 0;

    return (
        <div className="plan-grid">
            {rollingDays.map(({ iso, label, long, isToday }) => {
                const dayPlan = plan[iso] || [];
                const schedule = dayPlans[iso];
                const steps = schedule?.plan?.steps || [];

                return (
                    <Card
                        key={iso}
                        title={label}
                        className={['plan-day', isToday ? 'plan-day--today' : ''].filter(Boolean).join(' ')}
                        actions={dayPlan.length > 0 && (
                            <>
                                {/* The same schedule a menu gets. A Tuesday with
                                    a dal on it has an overnight soak in it just
                                    as surely as a dinner party does. */}
                                <Button
                                    icon
                                    size="sm"
                                    label={`Cooking schedule for ${long}`}
                                    onClick={() => setScheduling(iso)}
                                >
                                    <GiHourglass />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => onClearDay(iso)}>
                                    Clear day
                                </Button>
                            </>
                        )}
                    >
                        {dayPlan.length === 0 ? (
                            <EmptyState
                                icon={<GiEmptyHourglass />}
                                message="Nothing planned."
                                actionLabel="Add a recipe"
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

                                {/* What the schedule says, from the card: when to
                                    start, and how much of it is already done. */}
                                {steps.length > 0 && (
                                    <button
                                        type="button"
                                        className="plan-day__schedule"
                                        onClick={() => setScheduling(iso)}
                                    >
                                        <GiHourglass />
                                        {' '}Start {clockLabel(steps[0].at_time)}
                                        {steps[0].at_date !== iso ? ' the day before' : ''}
                                        {' · '}
                                        {steps.filter((s) => s.done).length}/{steps.length} done
                                    </button>
                                )}

                                <Button
                                    variant="primary"
                                    size="sm"
                                    block
                                    onClick={() => onAddToDay(iso)}
                                >
                                    <GiKnifeFork /> Add a recipe
                                </Button>
                            </div>
                        )}
                    </Card>
                );
            })}

            {open && (
                <CookPlan
                    title={open.long}
                    subtitle={open.isToday ? 'today' : ''}
                    dishes={openDishes}
                    plan={openRow?.plan || null}
                    serveDate={open.iso}
                    serveTime={openRow?.serve_time || ''}
                    fixedDate={open.iso}
                    fixedDateLabel={open.long}
                    request={{ date: open.iso }}
                    nothingToCook="Nothing is planned for this day yet — add a recipe and the schedule can work around it."
                    onClose={() => setScheduling(null)}
                    onSetServeTime={({ serve_time: serveTime }) => onSetServeTime(open.iso, serveTime)}
                    onSavePlan={(next) => onSavePlan(open.iso, next)}
                />
            )}
        </div>
    );
};

export default MealPlanner;
