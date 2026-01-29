import React from 'react';
import WidgetCard from '../components/WidgetCard';

const Learning = () => {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="box-header" style={{
                fontSize: '2rem',
                marginBottom: 'var(--space-lg)',
                color: 'var(--text-main)',
                borderBottom: 'var(--border-double)',
                paddingBottom: 'var(--space-md)'
            }}>
                Learning
            </h1>
            <WidgetCard>
                <div style={{
                    padding: 'var(--space-xl)',
                    textAlign: 'center',
                    fontStyle: 'italic',
                    color: 'var(--text-muted)'
                }}>
                    "Knowledge is the only treasure that increases by being shared."
                    <br /><br />
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>— Module Under Construction —</span>
                </div>
            </WidgetCard>
        </div>
    );
};

export default Learning;
