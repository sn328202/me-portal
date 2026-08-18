import React, { useState } from 'react';
import { useNews } from '../hooks/useNews';
import { GiEmptyHourglass, GiNewspaper, GiGears } from 'react-icons/gi';
import '../styles/Learning.css';

const Learning = () => {
    const { config, saveConfig, articles, loading, error } = useNews();
    const [isEditing, setIsEditing] = useState(false);

    // Form State
    const [apiKey, setApiKey] = useState('');
    const [topicsInput, setTopicsInput] = useState('');
    const [sourcesInput, setSourcesInput] = useState('');

    // Load current config into form when editing starts
    const startEditing = () => {
        setApiKey(config.apiKey);
        setTopicsInput(config.topics.join(', '));
        setSourcesInput(config.sources.join(', '));
        setIsEditing(true);
    };

    const handleSave = (e) => {
        e.preventDefault();
        const newTopics = topicsInput.split(',').map(s => s.trim()).filter(s => s);
        const newSources = sourcesInput.split(',').map(s => s.trim()).filter(s => s);

        saveConfig({
            apiKey,
            topics: newTopics,
            sources: newSources
        });
        setIsEditing(false);
    };

    // --- Render Logic ---

    // 1. Configuration View
    if (isEditing || !config.apiKey) {
        return (
            <div className="learning-config-container">
                <h1 className="learning-title" style={{ borderBottom: '1px solid var(--border-gold)', paddingBottom: '0.5rem' }}>
                    The Curator Configuration
                </h1>
                <p className="learning-subtitle">
                    "To be informed is to be armed."
                </p>

                <form onSubmit={handleSave} className="learning-form">
                    <div className="learning-form-group">
                        <label className="learning-label">NewsAPI Key</label>
                        <input
                            type="text"
                            className="learning-input"
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="Get key from newsapi.org"
                            required
                        />
                        <small className="learning-helper">Required. Free for development.</small>
                    </div>

                    <div className="learning-form-group">
                        <label className="learning-label">Topics of Interest</label>
                        <input
                            type="text"
                            className="learning-input"
                            value={topicsInput}
                            onChange={e => setTopicsInput(e.target.value)}
                            placeholder="AI, Victorian History, Archaeology (comma separated)"
                        />
                    </div>

                    <div className="learning-form-group">
                        <label className="learning-label">Specific Sources (Optional)</label>
                        <input
                            type="text"
                            className="learning-input"
                            value={sourcesInput}
                            onChange={e => setSourcesInput(e.target.value)}
                            placeholder="wired, bbc-news, the-verge (comma separated IDs)"
                        />
                    </div>

                    <button type="submit" className="learning-btn-save">
                        Save Configuration
                    </button>
                    {config.apiKey && (
                        <button
                            type="button"
                            className="learning-btn-cancel"
                            onClick={() => setIsEditing(false)}
                        >
                            Cancel
                        </button>
                    )}
                </form>
            </div>
        );
    }

    // 2. Feed View
    return (
        <div className="learning-container">
            {/* Header */}
            <div className="learning-header">
                <div>
                    <h1 className="learning-title">The Curator</h1>
                    <div className="learning-tags">
                        {config.topics.map(t => (
                            <span key={t} className="learning-tag">
                                #{t}
                            </span>
                        ))}
                    </div>
                </div>
                <button onClick={startEditing} title="Configure" aria-label="Configure curator topics" className="config-btn">
                    <GiGears />
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="error-container">
                    <strong>Disturbance in the wire:</strong> {error}
                </div>
            )}

            {/* Loading Display */}
            {loading && (
                <div className="loading-container">
                    <GiEmptyHourglass size={48} className="spin" />
                    <p>Fetching intelligence from the wire...</p>
                </div>
            )}

            {/* Grid */}
            {!loading && (
                <div className="learning-grid">
                    {articles.map((article, i) => (
                        <div key={i} className="widget-card article-card">
                            {article.urlToImage ? (
                                <div className="article-image" style={{ backgroundImage: `url(${article.urlToImage})` }} />
                            ) : (
                                <div className="article-placeholder">
                                    <GiNewspaper size={48} style={{ opacity: 0.2 }} />
                                </div>
                            )}

                            <div className="article-content">
                                <small className="article-meta">
                                    {article.source.name} • {new Date(article.publishedAt).toLocaleDateString()}
                                </small>
                                <h3 className="article-title">
                                    {article.title}
                                </h3>
                                <p className="article-excerpt">
                                    {article.description}
                                </p>
                                <a
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="article-link"
                                >
                                    Read Full Report
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Learning;
