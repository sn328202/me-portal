import React from 'react';
import { Link } from 'react-router-dom';
import { GiKeyLock } from 'react-icons/gi';
import { Button } from '../components/ui';

/* `.btn-primary` exists now (it was referenced twice and defined nowhere),
   so the link finally renders as a button. Routed through the Button
   primitive with `as={Link}` so it picks up the same states as every other
   action in the app. */
const NotFound = () => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-8) var(--space-6)',
        textAlign: 'center'
    }}>
        <span style={{ fontSize: 'var(--text-4xl)', color: 'var(--text-gold)', opacity: 0.5 }} aria-hidden="true">
            <GiKeyLock />
        </span>
        <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            letterSpacing: 'var(--tracking-heading)',
            textTransform: 'var(--case-heading)',
            color: 'var(--text-gold)',
            margin: 0
        }}>
            This room does not exist
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            The page you are looking for is not part of the portal.
        </p>
        <Button as={Link} to="/" variant="primary">
            Return to the Dashboard
        </Button>
    </div>
);

export default NotFound;
