import React, { useState } from 'react';
import { useNews } from '../hooks/useNews';
import { GiEmptyHourglass, GiNewspaper, GiGears, GiScrollUnfurled } from 'react-icons/gi';
import { Button, Card, PageHeader, Field, Tag, EmptyState } from '../components/ui';
import '../styles/Learning.css';

/**
 * Article URLs and image URLs are the only externally-controlled hrefs in the
 * app — they arrive from whatever NewsAPI hands back. Anything that is not an
 * absolute http(s) URL is dropped rather than rendered, so a `javascript:` or
 * `data:` payload can never reach an href or a background-image.
 */
const safeHttpUrl = (raw) => {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
        const url = new URL(raw);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
};

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
            <div className="page learning-config-container">
                <PageHeader
                    title="The Curator"
                    icon={<GiScrollUnfurled />}
                    subtitle={'"To be informed is to be armed."'}
                />

                <Card title="Configuration">
                    <form onSubmit={handleSave} className="learning-form">
                        <Field
                            label="NewsAPI Key"
                            hint="Required. Free for development."
                            type="text"
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="Get key from newsapi.org"
                            required
                        />

                        <Field
                            label="Topics of Interest"
                            type="text"
                            value={topicsInput}
                            onChange={e => setTopicsInput(e.target.value)}
                            placeholder="AI, Victorian History, Archaeology (comma separated)"
                        />

                        <Field
                            label="Specific Sources (Optional)"
                            type="text"
                            value={sourcesInput}
                            onChange={e => setSourcesInput(e.target.value)}
                            placeholder="wired, bbc-news, the-verge (comma separated IDs)"
                        />

                        <div className="row row--wrap">
                            <Button type="submit" variant="primary">
                                Save Configuration
                            </Button>
                            {config.apiKey && (
                                <Button variant="ghost" onClick={() => setIsEditing(false)}>
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </form>
                </Card>
            </div>
        );
    }

    // 2. Feed View
    return (
        <div className="page learning-container">
            <PageHeader
                title="The Curator"
                icon={<GiScrollUnfurled />}
                subtitle={config.topics.length ? undefined : 'No topics set — the wire is quiet.'}
                actions={
                    <Button
                        icon
                        label="Configure curator topics"
                        className="config-btn"
                        onClick={startEditing}
                    >
                        <GiGears />
                    </Button>
                }
            />

            {config.topics.length > 0 && (
                <div className="tag-list learning-tags">
                    {config.topics.map(t => (
                        <Tag key={t}>#{t}</Tag>
                    ))}
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="error-container" role="alert">
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
            {!loading && articles.length === 0 && (
                <EmptyState
                    icon={<GiNewspaper />}
                    message="The wire returned nothing today."
                    hint="Widen the topics and the Curator will try again."
                    actionLabel="Adjust Topics"
                    onAction={startEditing}
                />
            )}

            {!loading && articles.length > 0 && (
                <div className="learning-grid">
                    {articles.map((article, i) => {
                        const href = safeHttpUrl(article.url);
                        const image = safeHttpUrl(article.urlToImage);

                        return (
                            <Card
                                key={href || i}
                                variant="flat"
                                padded={false}
                                className="article-card"
                                bodyClassName="article-card__body"
                            >
                                {image ? (
                                    <div
                                        className="article-image"
                                        role="presentation"
                                        style={{ backgroundImage: `url("${encodeURI(image)}")` }}
                                    />
                                ) : (
                                    <div className="article-placeholder">
                                        <GiNewspaper size={48} />
                                    </div>
                                )}

                                <div className="article-content">
                                    <small className="article-meta">
                                        {article.source?.name || 'Unattributed'}
                                        {article.publishedAt ? ` • ${new Date(article.publishedAt).toLocaleDateString()}` : ''}
                                    </small>
                                    <h2 className="article-title">
                                        {article.title}
                                    </h2>
                                    <p className="article-excerpt">
                                        {article.description}
                                    </p>
                                    {href && (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="article-link"
                                        >
                                            Read Full Report
                                        </a>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Learning;
