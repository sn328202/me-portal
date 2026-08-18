import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// NewsAPI Base URL
// const NEWS_API_BASE = 'https://newsapi.org/v2'; // Deprecated for direct calls

export const useNews = () => {
    const { user } = useAuth();
    const [config, setConfig] = useState({ apiKey: '', topics: [], sources: [] });
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load Config from Supabase
    useEffect(() => {
        const controller = new AbortController();
        fetchConfig(controller.signal);
        return () => controller.abort();
    }, [user]);

    const fetchConfig = async (signal) => {
        setLoading(true);
        if (!user) {
            setConfig({ apiKey: '', topics: [], sources: [] });
            setArticles([]);
            setLoading(false);
            return;
        }

        try {
            const { data, error: configError } = await supabase
                .from('user_news_config')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (configError) {
                // A failed query is not the same as "no config yet"
                console.error('Error loading news config:', configError);
                setError(configError.message || 'Failed to load news preferences');
                return;
            }

            if (data) {
                const topics = data.topics || [];
                const sources = data.sources || [];

                setConfig({
                    apiKey: data.api_key || import.meta.env.VITE_NEWS_API_KEY || '',
                    topics,
                    sources
                });
                // If we have config, load news
                if ((data.api_key || import.meta.env.VITE_NEWS_API_KEY) && ((topics?.length || 0) > 0 || (sources?.length || 0) > 0)) {
                    // fetchHeadlines owns the loading flag from here on
                    await fetchHeadlines(data.api_key || import.meta.env.VITE_NEWS_API_KEY, topics, sources, signal);
                }
            } else {
                // No config exists yet, check env
                if (import.meta.env.VITE_NEWS_API_KEY) {
                    setConfig(prev => ({ ...prev, apiKey: import.meta.env.VITE_NEWS_API_KEY }));
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async (newConfig) => {
        if (!user) return;

        const { error: saveError } = await supabase
            .from('user_news_config')
            .upsert({
                user_id: user.id,
                api_key: newConfig.apiKey,
                topics: newConfig.topics,
                sources: newConfig.sources
            }, { onConflict: 'user_id' });

        if (saveError) {
            console.error('Error saving news config:', saveError);
            setError('Failed to save preferences');
        } else {
            setConfig(newConfig);
            // Reload news with new config
            fetchHeadlines(newConfig.apiKey, newConfig.topics, newConfig.sources);
        }
    };

    const fetchHeadlines = async (key, topics, sources, signal) => {
        setLoading(true);
        setError(null);
        try {
            // Refactored for Local Proxy Compatibility:
            // Path structure: /api/news/<endpoint>?apiKey=...

            let endpoint = '';
            const params = new URLSearchParams({ apiKey: key });

            if (sources.length > 0) {
                endpoint = 'top-headlines';
                params.append('sources', sources.join(','));
            } else if (topics.length > 0) {
                endpoint = 'everything';
                params.append('q', topics.join(' OR '));
                params.append('language', 'en');
                params.append('sortBy', 'publishedAt');
            } else {
                setArticles([]);
                setLoading(false);
                return;
            }

            // Construct URL: /api/news/everything?params
            const url = `/api/news/${endpoint}?${params.toString()}`;

            const res = await fetch(url, { signal });

            // Check content type
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await res.text();
                // console.error("Non-JSON API response:", text); 
                throw new Error(`API returned invalid format (Status: ${res.status}). See console.`);
            }

            const json = await res.json();

            if (json.status === 'error' || json.error) {
                throw new Error(json.message || json.error);
            }

            setArticles(json.articles || []);

        } catch (err) {
            if (err.name === 'AbortError') {
                return; // Ignore intentional aborts
            }
            console.error(err);
            if (err.message.includes('browser')) {
                setError('NewsAPI Error: Browser requests blocked on free plan. (Dev Only)');
            } else {
                setError(err.message || 'Failed to load news');
            }
        } finally {
            setLoading(false);
        }
    };

    return {
        config,
        saveConfig,
        articles,
        loading,
        error
    };
};
