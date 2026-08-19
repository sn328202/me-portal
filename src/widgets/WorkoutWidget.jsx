import React, { useState } from 'react';
import WidgetCard from '../components/WidgetCard';
import WidgetLoading from '../components/WidgetLoading';
import EmptyState from '../components/EmptyState';
import Button from '../components/ui/Button';
import { useWorkouts } from '../hooks/useWorkouts';
import { GiWeightLiftingUp, GiSettingsKnobs, GiCheckMark } from 'react-icons/gi';

const WorkoutWidget = () => {
    const { getTodayWorkout, updateWorkout, loading } = useWorkouts();
    const [isEditing, setIsEditing] = useState(false);
    const todayWorkout = getTodayWorkout();

    if (loading) {
        return (
            <WidgetCard title="Physical Readiness" icon={<GiWeightLiftingUp />}>
                <WidgetLoading />
            </WidgetCard>
        );
    }

    if (!todayWorkout) {
        return (
            <WidgetCard title="Physical Readiness" icon={<GiWeightLiftingUp />}>
                <EmptyState
                    icon={<GiWeightLiftingUp />}
                    message="No training scheduled for today."
                    hint="Rest well."
                />
            </WidgetCard>
        );
    }

    const steps = todayWorkout.details || [];

    const toggleStep = (index) => {
        const newDetails = [...steps];
        newDetails[index].completed = !newDetails[index].completed;
        updateWorkout(todayWorkout.id, todayWorkout.title, newDetails);
    };

    return (
        <WidgetCard title="Physical Readiness" icon={<GiWeightLiftingUp />}>
            <div style={{
                background: 'rgba(0,0,0,0.2)',
                padding: 'var(--space-md)',
                borderRadius: '8px',
                border: '1px solid var(--border-gold)',
                fontFamily: 'var(--font-serif)',
                position: 'relative'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                    <h4 style={{ margin: 0, color: 'var(--text-gold)', fontStyle: 'italic', fontSize: '1.1rem' }}>
                        {todayWorkout.title}
                    </h4>
                    <Button
                        icon
                        size="sm"
                        onClick={() => setIsEditing(!isEditing)}
                        label={isEditing ? 'Stop editing workout' : 'Edit workout'}
                    >
                        <GiSettingsKnobs />
                    </Button>
                </div>

                {isEditing ? (
                    <WorkoutEditor
                        workout={todayWorkout}
                        onSave={(title, details) => {
                            updateWorkout(todayWorkout.id, title, details);
                            setIsEditing(false);
                        }}
                        onCancel={() => setIsEditing(false)}
                    />
                ) : (
                    <div className="workout-checklist">
                        {steps.map((step, idx) => (
                            <div
                                key={idx}
                                onClick={() => toggleStep(idx)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px',
                                    padding: '8px 0',
                                    cursor: 'pointer',
                                    opacity: step.completed ? 0.5 : 1,
                                    borderBottom: idx === steps.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)'
                                }}
                            >
                                <div style={{
                                    width: '18px',
                                    height: '18px',
                                    border: '1px solid var(--border-gold)',
                                    borderRadius: '3px',
                                    flexShrink: 0,
                                    marginTop: '3px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {step.completed && <GiCheckMark size={12} color="var(--text-gold)" />}
                                </div>
                                <span style={{
                                    textDecoration: step.completed ? 'line-through' : 'none',
                                    fontSize: '0.9rem',
                                    lineHeight: '1.4'
                                }}>
                                    {step.text}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ marginTop: 'var(--space-md)', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'right' }}>
                    — The body is a temple; fortify its walls.
                </div>
            </div>
        </WidgetCard>
    );
};

const WorkoutEditor = ({ workout, onSave, onCancel }) => {
    const [title, setTitle] = useState(workout.title);
    const [details, setDetails] = useState([...(workout.details || [])]);

    const handleStepChange = (idx, text) => {
        const newDetails = [...details];
        newDetails[idx].text = text;
        setDetails(newDetails);
    };

    const addStep = () => setDetails([...details, { text: '', completed: false }]);
    const removeStep = (idx) => setDetails(details.filter((_, i) => i !== idx));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Workout Title"
                aria-label="Workout title"
                style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-gold)',
                    color: 'var(--text-main)',
                    padding: '8px',
                    borderRadius: '4px'
                }}
            />
            {details.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '5px' }}>
                    <input
                        value={step.text}
                        onChange={(e) => handleStepChange(idx, e.target.value)}
                        placeholder="Step description"
                        aria-label={`Step ${idx + 1} description`}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px dashed var(--border-gold)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem'
                        }}
                    />
                    <Button
                        icon
                        size="sm"
                        variant="danger"
                        type="button"
                        onClick={() => removeStep(idx)}
                        label={`Remove step ${idx + 1}`}
                    >×</Button>
                </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addStep}>+ Add Step</Button>
            <div className="row">
                <Button variant="solid" size="sm" onClick={() => onSave(title, details)}>
                    Keep Changes
                </Button>
                <Button variant="ghost" size="sm" onClick={onCancel}>
                    Discard
                </Button>
            </div>
        </div>
    );
};

export default WorkoutWidget;
