import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                // Get initial session with a safety catch
                const { data: { session: initialSession }, error } = await supabase.auth.getSession();
                if (error) throw error;

                if (mounted) {
                    setSession(initialSession);
                    setUser(initialSession?.user ?? null);
                }
            } catch (err) {
                // Silence AbortError as it's common during network timeouts
                if (err.name !== 'AbortError') {
                    console.warn("Recoverable auth initialization error:", err.message || err);
                }
            } finally {
                if (mounted) setLoading(false);
            }

            // Listen for changes
            try {
                const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                    if (mounted) {
                        setSession(session);
                        setUser(session?.user ?? null);
                        setLoading(false);
                    }
                });
                return subscription;
            } catch (subErr) {
                console.error("Auth listener failed to mount:", subErr);
                return null;
            }
        };

        const subPromise = initializeAuth();

        return () => {
            mounted = false;
            subPromise.then(sub => sub?.unsubscribe()).catch(() => { });
        };
    }, []);

    const signIn = async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const signUp = async (email, password) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const value = {
        session,
        user,
        signIn,
        signUp,
        signOut,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
