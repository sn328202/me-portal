import React, { useState } from 'react';
import KanbanBoard from '../components/KanbanBoard';
import StatusMonitor from '../components/StatusMonitor';
import { GiTiedScroll, GiSatelliteCommunication } from 'react-icons/gi';

const Studio = () => {
    const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'monitor'

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
                padding: '1.5rem 2rem 0 2rem',
                borderBottom: '1px solid var(--border-gold)',
                background: 'var(--bg-panel)',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end'
            }}>
                <div>
                    <h1 className="cinzel-font" style={{ margin: 0, color: 'var(--text-gold)', fontSize: '2rem' }}>The Study</h1>
                    <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', marginBottom: '1.5rem' }}>
                        "A place for industry, architecture, and the meticulous plotting of grand designs."
                    </p>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => setActiveTab('ledger')}
                        style={{
                            padding: '0.8rem 1.5rem',
                            background: activeTab === 'ledger' ? 'var(--bg-main)' : 'transparent',
                            border: '1px solid var(--border-gold)',
                            borderBottom: activeTab === 'ledger' ? '1px solid var(--bg-main)' : '1px solid var(--border-gold)',
                            marginBottom: '-1px',
                            color: activeTab === 'ledger' ? 'var(--text-gold)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-display)',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            borderRadius: '4px 4px 0 0',
                            transition: 'all 0.2s'
                        }}
                    >
                        <GiTiedScroll /> The Ledger
                    </button>
                    <button
                        onClick={() => setActiveTab('monitor')}
                        style={{
                            padding: '0.8rem 1.5rem',
                            background: activeTab === 'monitor' ? 'var(--bg-main)' : 'transparent',
                            border: '1px solid var(--border-gold)',
                            borderBottom: activeTab === 'monitor' ? '1px solid var(--bg-main)' : '1px solid var(--border-gold)',
                            marginBottom: '-1px',
                            color: activeTab === 'monitor' ? 'var(--text-gold)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-display)',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            borderRadius: '4px 4px 0 0',
                            transition: 'all 0.2s'
                        }}
                    >
                        <GiSatelliteCommunication /> The Monitor
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', padding: '0 1rem 1rem 1rem' }}>
                {activeTab === 'ledger' ? <KanbanBoard /> : <StatusMonitor />}
            </div>
        </div>
    );
};

export default Studio;
