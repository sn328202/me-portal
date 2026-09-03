import React, { useState } from 'react';
import { useNews } from '../hooks/useNews';
import { GiEmptyHourglass, GiNewspaper, GiGears } from 'react-icons/gi';
import { Button, Card, Field, Modal, Tag, EmptyState } from './ui';
import '../styles/Learning.css';

/**
 * The wire, as a section of the Study rather than a room of its own.
 *
 * It was a whole room in the rail called "Learning", which promised more than
 * a news feed delivers — and the feed itself was set once, in January, on
 * seven catch-all topics, and never opened again. A room you do not enter is
 * a room that is costing you a place in the rail.
 *
 * The Study is where the things you *do* already live: the ledger and the
 * monitor. What you are reading belongs beside them.
 *
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

const Curator = () => {
    const { config, saveConfig, articles, loading, error } = useNews();

    /* The settings used to replace the whole page, which is a fine thing for a
       room to do and a wrong thing for a tab — it took the other two sections
       away with it. It is a dialog now. */
    const [editing, setEditing] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [topicsInput, setTopicsInput] = useState('');
    const [sourcesInput, setSourcesInput] = useState('');

    const open = () => {
        setApiKey(config.apiKey);
        setTopicsInput(config.topics.join(', '));
        setSourcesInput(config.sources.join(', '));
        setEditing(true);
    };

    const save = (e) => {
        e.preventDefault();
        const split = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
        saveConfig({ apiKey, topics: split(topicsInput), sources: split(sourcesInput) });
        setEditing(false);
    };

    const settings = (
        <Modal
            open={editing}
            onClose={() => setEditing(false)}
            title="What the wire watches"
            footer={<Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
        >
            <form onSubmit={save} className="learning-form">
                <Field
                    label="NewsAPI Key"
                    hint="Required. Free for development."
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Get key from newsapi.org"
                    required
                />
                <Field
                    label="Topics of Interest"
                    type="text"
                    value={topicsInput}
                    onChange={(e) => setTopicsInput(e.target.value)}
                    placeholder="AI, Victorian History, Archaeology (comma separated)"
                />
                <Field
                    label="Specific Sources (Optional)"
                    type="text"
                    value={sourcesInput}
                    onChange={(e) => setSourcesInput(e.target.value)}
                    placeholder="wired, bbc-news, the-verge (comma separated IDs)"
                />
                <Button type="submit" variant="primary">Save</Button>
            </form>
        </Modal>
    );

    /* No key means the wire cannot be reached at all, so the section says so
       rather than drawing an empty grid and letting her wonder. */
    if (!config.apiKey) {
        return (
            <>
                <EmptyState
                    icon={<GiNewspaper />}
                    message="The wire is not connected."
                    hint="It needs a NewsAPI key before it can fetch anything."
                    actionLabel="Connect the wire"
                    onAction={open}
                />
                {settings}
            </>
        );
    }

    return (
        <div className="learning-container">
            <div className="curator__head">
                <div className="tag-list learning-tags">
                    {config.topics.length > 0
                        ? config.topics.map((t) => <Tag key={t}>#{t}</Tag>)
                        : <span className="muted">No topics set — the wire is quiet.</span>}
                </div>
                <Button icon label="Change what the wire watches" onClick={open}>
                    <GiGears />
                </Button>
            </div>

            {error && (
                <div className="error-container" role="alert">
                    <strong>Disturbance in the wire:</strong> {error}
                </div>
            )}

            {loading && (
                <div className="loading-container">
                    <GiEmptyHourglass size={48} className="spin" />
                    <p>Fetching intelligence from the wire...</p>
                </div>
            )}

            {!loading && articles.length === 0 && (
                <EmptyState
                    icon={<GiNewspaper />}
                    message="The wire returned nothing today."
                    hint="Widen the topics and the Curator will try again."
                    actionLabel="Adjust Topics"
                    onAction={open}
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
                                    <h2 className="article-title">{article.title}</h2>
                                    <p className="article-excerpt">{article.description}</p>
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

            {settings}
        </div>
    );
};

export default Curator;
