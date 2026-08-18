import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GiSkeletonKey, GiScrollUnfurled } from 'react-icons/gi';

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

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '80vh',
            padding: '2rem'
        }}>
            <div style={{
                background: 'var(--bg-panel)',
                border: 'var(--border-double)',
                padding: '3rem',
                width: '100%',
                maxWidth: '450px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <GiSkeletonKey style={{ fontSize: '3rem', color: 'var(--accent-gold)' }} />
                    <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-gold)', margin: '0.5rem 0' }}>
                        {isLogin ? 'Grant Access' : 'New Registry'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {isLogin ? 'Enter your credentials to unlock the archive.' : 'Inscribe your signature to begin a new collection.'}
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(255, 0, 0, 0.1)',
                        border: '1px solid var(--accent-red)',
                        color: 'var(--accent-red)',
                        padding: '1rem',
                        fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                {notice && (
                    <div role="status" style={{
                        background: 'rgba(212, 175, 55, 0.1)',
                        border: '1px solid var(--accent-gold)',
                        color: 'var(--text-gold)',
                        padding: '1rem',
                        fontSize: '0.9rem'
                    }}>
                        {notice}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label htmlFor="auth-email" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-gold)', fontSize: '0.9rem' }}>Email Cipher</label>
                        <input
                            id="auth-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--border-dim)',
                                padding: '10px',
                                color: 'var(--text-main)',
                                fontFamily: 'var(--font-mono)'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label htmlFor="auth-password" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-gold)', fontSize: '0.9rem' }}>Secret Key</label>
                        <input
                            id="auth-password"
                            name="password"
                            type="password"
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--border-dim)',
                                padding: '10px',
                                color: 'var(--text-main)',
                                fontFamily: 'var(--font-mono)'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '1rem',
                            padding: '12px',
                            background: 'var(--accent-gold)',
                            color: 'var(--bg-main)',
                            border: 'none',
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            cursor: loading ? 'wait' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Authenticating...' : (isLogin ? 'UNLOCK' : 'INSCRIBE')}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setError(''); setNotice(''); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-dim)',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-body)'
                        }}
                    >
                        {isLogin ? 'Need a new ledger? Sign up.' : 'Already have a key? Sign in.'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Auth;
