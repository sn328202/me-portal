import React, { useState, useEffect, useMemo } from 'react';
import { GiCheckMark, GiPreviousButton, GiNextButton, GiCancel, GiCookingPot } from 'react-icons/gi';

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

    const handleNext = () => {
        if (currentStep < steps.length) {
            setCurrentStep(c => c + 1);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(c => c - 1);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [currentStep, steps]);

    const isFinished = currentStep === steps.length;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--bg-main)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <GiCookingPot /> {recipe.title}
                </h2>
                <button onClick={onClose} style={{
                    background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-muted)',
                    padding: '8px 16px', fontFamily: 'var(--font-display)', textTransform: 'uppercase', cursor: 'pointer'
                }}>
                    Exit Ritual <GiCancel style={{ marginLeft: '8px' }} />
                </button>
            </div>

            {/* Progress Bar */}
            <div style={{ height: '4px', background: 'var(--bg-panel)', marginBottom: '2rem', width: '100%' }}>
                <div style={{
                    height: '100%',
                    width: `${(currentStep / steps.length) * 100}%`,
                    background: 'var(--accent-gold)',
                    transition: 'width 0.3s ease'
                }} />
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', maxWidth: '1000px', margin: '0 auto' }}>
                {!isFinished ? (
                    <>
                        <div style={{ fontSize: '1.2rem', color: 'var(--text-gold)', marginBottom: '1rem', fontFamily: 'var(--font-mono)' }}>
                            STEP {currentStep + 1} OF {steps.length}
                        </div>
                        <div style={{
                            fontSize: '2.5rem',
                            lineHeight: 1.4,
                            fontFamily: 'var(--font-body)',
                            animation: 'fadeIn 0.5s ease'
                        }}>
                            {steps[currentStep]}
                        </div>
                    </>
                ) : (
                    <div style={{ animation: 'fadeIn 0.5s ease' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '2rem', color: 'var(--accent-gold)' }}>
                            <GiCheckMark />
                        </div>
                        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', marginBottom: '1rem' }}>Ritual Complete</h1>
                        <p style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>The dish is ready to serve.</p>

                        <button onClick={onClose} style={{
                            marginTop: '2rem',
                            padding: '1rem 3rem',
                            background: 'var(--accent-gold)',
                            color: 'var(--bg-main)',
                            border: 'none',
                            fontSize: '1.5rem',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                        }}>
                            Finish
                        </button>
                    </div>
                )}
            </div>

            {/* Controls */}
            {!isFinished && (
                <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '600px', width: '100%', margin: '0 auto', gap: '2rem' }}>
                    <button
                        onClick={handlePrev}
                        disabled={currentStep === 0}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            border: '1px solid var(--border-gold)',
                            background: 'transparent',
                            color: currentStep === 0 ? 'var(--text-muted)' : 'var(--text-main)',
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.2rem',
                            cursor: currentStep === 0 ? 'default' : 'pointer',
                            opacity: currentStep === 0 ? 0.3 : 1
                        }}
                    >
                        Previous
                    </button>
                    <button
                        onClick={handleNext}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            background: 'var(--accent-gold)',
                            border: '1px solid var(--accent-gold)',
                            color: 'var(--bg-main)',
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                        }}
                    >
                        {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default CookMode;
