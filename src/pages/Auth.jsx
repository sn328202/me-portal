import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GiSkeletonKey } from 'react-icons/gi';
import { Button } from '../components/ui';

/**
 * The best-looking screen in the app, and deliberately left that way: key
 * glyph, gold display-face heading, italic subtitle, a bordered panel
 * floating on the noise texture.
 *
 * The only change is that every literal it used to hardcode (3rem padding,
 * a 450px panel, rgba(255,0,0,0.1), a 10px input, a 1.1rem gold button) is
 * now a token, so the panel takes on each skin's rule, radius, shadow and
 * type ramp instead of staying Victorian on all seven.
 */
const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setNotice('');
        setLoading(true);

        try {
            if (isLogin) {
                await signIn(email, password);
                navigate('/');
            } else {
                await signUp(email, password);
                // Supabase auto-logs in when email confirmation is disabled; otherwise
                // there is no session yet and navigating would bounce straight back here.
                const { data } = await supabase.auth.getSession();
                if (data?.session) {
                    navigate('/');
                } else {
                    setNotice('Check your email — we sent a confirmation link. Once confirmed, sign in below.');
                    setIsLogin(true);
                    setPassword('');
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fieldStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)'
    };

    const inputStyle = {
        background: 'var(--field-bg)',
        border: 'var(--rule-hair)',
        borderRadius: 'var(--radius-sm)',
        padding: 'var(--space-3)',
        color: 'var(--text-main)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-base)'
    };

    const labelStyle = {
        fontFamily: 'var(--font-display)',
        color: 'var(--text-gold)',
        fontSize: 'var(--text-sm)',
        letterSpacing: 'var(--tracking-label)'
    };

    const bannerStyle = {
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--text-sm)',
        lineHeight: 'var(--leading-snug)'
    };

    return (
        <main style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '80vh',
            padding: 'var(--space-6)'
        }}>
            <div style={{
                background: 'var(--bg-panel)',
                border: 'var(--rule)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-7)',
                width: '100%',
                maxWidth: '28rem',
                boxShadow: 'var(--shadow-lift)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                    <GiSkeletonKey style={{ fontSize: 'var(--text-4xl)', color: 'var(--accent-gold)' }} />
                    <h1 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-2xl)',
                        color: 'var(--text-gold)',
                        margin: 'var(--space-2) 0'
                    }}>
                        {isLogin ? 'Grant Access' : 'New Registry'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                        {isLogin ? 'Enter your credentials to unlock the archive.' : 'Inscribe your signature to begin a new collection.'}
                    </p>
                </div>

                {error && (
                    <div role="alert" style={{
                        ...bannerStyle,
                        border: '1px solid var(--accent-red)',
                        color: 'var(--accent-red)'
                    }}>
                        {error}
                    </div>
                )}

                {notice && (
                    <div role="status" style={{
                        ...bannerStyle,
                        background: 'var(--accent-gold-dim)',
                        border: 'var(--rule-accent)',
                        color: 'var(--text-gold)'
                    }}>
                        {notice}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={fieldStyle}>
                        <label htmlFor="auth-email" style={labelStyle}>Email Cipher</label>
                        <input
                            id="auth-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div style={fieldStyle}>
                        <label htmlFor="auth-password" style={labelStyle}>Secret Key</label>
                        <input
                            id="auth-password"
                            name="password"
                            type="password"
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="solid"
                        block
                        disabled={loading}
                        style={{
                            marginTop: 'var(--space-4)',
                            fontSize: 'var(--text-lg)',
                            cursor: loading ? 'wait' : 'pointer'
                        }}
                    >
                        {loading ? 'Authenticating...' : (isLogin ? 'UNLOCK' : 'INSCRIBE')}
                    </Button>
                </form>

                <div style={{ textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setError(''); setNotice(''); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-dim)',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-body)',
                            fontSize: 'var(--text-sm)'
                        }}
                    >
                        {isLogin ? 'Need a new ledger? Sign up.' : 'Already have a key? Sign in.'}
                    </button>
                </div>
            </div>
        </main>
    );
};

export default Auth;
