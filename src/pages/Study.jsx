import React from 'react';
import WidgetCard from '../components/WidgetCard';
import KanbanBoard from '../components/KanbanBoard';
import StatusConsole from '../widgets/StatusConsole';

const Study = () => {
    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '2rem' }}>
            <h1 className="box-header" style={{
                fontSize: '2rem',
                marginBottom: 'var(--space-lg)',
                color: 'var(--text-main)',
                borderBottom: 'var(--border-double)',
                paddingBottom: 'var(--space-md)'
            }}>
                The Study
            </h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                {/* Top: Status Console */}
                <WidgetCard>
                    <StatusConsole />
                </WidgetCard>

                {/* Bottom: Kanban Board */}
                <WidgetCard>
                    <div style={{ padding: '1rem 2rem 0', borderBottom: '1px solid #e0e0e0' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', color: 'var(--text-gold)' }}>
                            Project Ledger
                        </h3>
                    </div>
                    <KanbanBoard />
                </WidgetCard>
            </div>
        </div>
    );
};

export default Study;
