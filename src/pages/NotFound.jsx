import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => (
    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-gold)' }}>
            This room does not exist
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            The page you are looking for is not part of the portal.
        </p>
        <Link to="/" className="btn-primary">
            Return to the Dashboard
        </Link>
    </div>
);

export default NotFound;
