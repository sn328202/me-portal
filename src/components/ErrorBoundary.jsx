import React from 'react';

/**
 * Catches render-time errors so one bad row or a malformed API response
 * degrades a single card instead of blanking the entire portal.
 *
 * Usage:
 *   <ErrorBoundary>                      // full-page fallback
 *   <ErrorBoundary variant="widget" label="The Larder">   // inline card fallback
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Caught by ErrorBoundary:', error, info?.componentStack);
    }

    handleReset = () => {
        this.setState({ error: null });
    };

    render() {
        const { error } = this.state;
        const { children, variant, label } = this.props;

        if (!error) return children;

        const isWidget = variant === 'widget';

        return (
            <div
                role="alert"
                /* The smoke test looks for exactly this: a component that gave
                   up. Every other role="alert" on a page is a notice doing its
                   job — "could not reach the portal just now" is not a crash —
                   and counting those as failures taught the harness to cry
                   wolf on every offline run. */
                data-error-boundary="true"
                style={{
                    padding: isWidget ? '1.25rem' : '3rem 2rem',
                    margin: isWidget ? 0 : '2rem auto',
                    maxWidth: isWidget ? 'none' : '640px',
                    border: '1px solid var(--border-dim)',
                    borderRadius: '4px',
                    background: 'var(--bg-panel)',
                    color: 'var(--text-main)',
                    textAlign: isWidget ? 'left' : 'center',
                }}
            >
                <h2
                    style={{
                        fontFamily: 'var(--font-display)',
                        color: 'var(--text-gold)',
                        fontSize: isWidget ? '1rem' : '1.5rem',
                        margin: '0 0 0.5rem',
                    }}
                >
                    {label ? `${label} could not be displayed` : 'Something went wrong'}
                </h2>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
                    The rest of the portal is unaffected.
                </p>
                <details style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <summary style={{ cursor: 'pointer' }}>Technical detail</summary>
                    <pre
                        style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            textAlign: 'left',
                            marginTop: '0.5rem',
                        }}
                    >
                        {String(error?.message || error)}
                    </pre>
                </details>
                <button type="button" onClick={this.handleReset} className="btn-primary">
                    Try again
                </button>
            </div>
        );
    }
}

export default ErrorBoundary;
