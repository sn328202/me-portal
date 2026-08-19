import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GiCheckMark, GiCancel, GiCookingPot } from 'react-icons/gi';
import { Button, Modal } from './ui';

const CookMode = ({ recipe, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);

    const steps = useMemo(() => {
        if (!recipe.instructions) return [];
        // Split by newlines, filter empty, trim
        return recipe.instructions
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }, [recipe]);

    const handleNext = useCallback(() => {
        setCurrentStep(c => (c < steps.length ? c + 1 : c));
    }, [steps.length]);

    const handlePrev = useCallback(() => {
        setCurrentStep(c => (c > 0 ? c - 1 : c));
    }, []);

    // Keyboard navigation. Escape is handled by the Modal itself.
    useEffect(() => {
        const handleKey = (e) => {
            // Don't double-fire when the focused control already handles the key.
            if (e.key === ' ' && e.target.closest?.('button')) return;
            if (e.key === 'ArrowRight' || e.key === ' ') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleNext, handlePrev]);

    const isFinished = currentStep === steps.length;

    return (
        <Modal open onClose={onClose} size="full">
            <div className="cook-mode">
                <div className="cook-mode__head">
                    <h2 className="cook-mode__title">
                        <GiCookingPot /> {recipe.title}
                    </h2>
                    <Button onClick={onClose}>
                        Exit Ritual <GiCancel />
                    </Button>
                </div>

                <div className="cook-mode__progress">
                    <div
                        className="cook-mode__progress-bar"
                        style={{ width: `${steps.length ? (currentStep / steps.length) * 100 : 0}%` }}
                    />
                </div>

                <div className="cook-mode__stage">
                    {!isFinished ? (
                        <>
                            <div className="cook-mode__step-count">
                                STEP {currentStep + 1} OF {steps.length}
                            </div>
                            <div className="cook-mode__step">
                                {steps[currentStep]}
                            </div>
                        </>
                    ) : (
                        <div className="cook-mode__done">
                            <div className="cook-mode__done-mark"><GiCheckMark /></div>
                            <h1 className="cook-mode__done-title">Ritual Complete</h1>
                            <p className="cook-mode__done-copy">The dish is ready to serve.</p>
                            <Button variant="solid" onClick={onClose}>Finish</Button>
                        </div>
                    )}
                </div>

                {!isFinished && (
                    <div className="cook-mode__controls">
                        <Button block onClick={handlePrev} disabled={currentStep === 0}>
                            Previous
                        </Button>
                        <Button block variant="solid" onClick={handleNext}>
                            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CookMode;
