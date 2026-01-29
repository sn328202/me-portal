import React, { useState } from 'react';
import { GiWaxSeal, GiPartyPopper } from 'react-icons/gi';
import WidgetCard from '../components/WidgetCard';
import { useSocial } from '../hooks/useSocial';

const SocialWidget = () => {
    const { events, addEvent, deleteEvent, loading } = useSocial();
    const [who, setWho] = useState('');
    const [what, setWhat] = useState('');
    const [when, setWhen] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = (e) => {
        e.preventDefault();
        if (!who || !what) return;
        addEvent({ who, what, when, where: '' }); // Location optional for now
        setWho('');
        setWhat('');
        setWhen('');
        setIsAdding(false);
    };

    return (
        <WidgetCard title="Social Register" icon={GiWaxSeal} actionIcon={isAdding ? null : '+'} onAction={() => setIsAdding(true)}>
            {isAdding && (
                <form onSubmit={handleAdd} style={{ marginBottom: '1rem', padding: '0.5rem', border: '1px dashed var(--border-dim)', background: 'var(--bg-hover)' }}>
                    <input
                        placeholder="Who?"
                        value={who} onChange={e => setWho(e.target.value)}
                        style={{ width: '100%', marginBottom: '0.3rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                    />
                    <input
                        placeholder="What?"
                        value={what} onChange={e => setWhat(e.target.value)}
                        style={{ width: '100%', marginBottom: '0.3rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                    />
                    <input
                        type="date"
                        value={when} onChange={e => setWhen(e.target.value)}
                        style={{ width: '100%', marginBottom: '0.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="submit" style={{ flex: 1, background: 'var(--text-gold)', border: 'none', padding: '0.2rem', cursor: 'pointer', color: 'var(--bg-main)' }}>RSVP</button>
                        <button type="button" onClick={() => setIsAdding(false)} style={{ background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.5rem' }}>Cancel</button>
                    </div>
                </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '250px', overflowY: 'auto' }}>
                {events.length === 0 && !isAdding && !loading && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '1rem' }}>
                        The calendar is clear.
                    </div>
                )}
                {events.map(plan => (
                    <div key={plan.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
                        <div>
                            <div style={{ fontWeight: 'bold', color: 'var(--text-gold)', fontSize: '0.9rem' }}>{plan.who}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{plan.what}</div>
                            {plan.when_date && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{new Date(plan.when_date).toLocaleDateString()}</div>}
                        </div>
                        <button onClick={() => deleteEvent(plan.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                    </div>
                ))}
            </div>
        </WidgetCard>
    );
};

export default SocialWidget;
