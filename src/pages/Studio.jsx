import React, { useState } from 'react';
import KanbanBoard from '../components/KanbanBoard';
import StatusMonitor from '../components/StatusMonitor';
import { GiTiedScroll, GiSatelliteCommunication, GiDesk } from 'react-icons/gi';
import { PageHeader, Tabs, TabPanel } from '../components/ui';

const TABS = [
    { id: 'ledger', label: 'The Ledger', icon: <GiTiedScroll /> },
    { id: 'monitor', label: 'The Monitor', icon: <GiSatelliteCommunication /> }
];

const Studio = () => {
    const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'monitor'

    return (
        <div className="page">
            <PageHeader
                title="The Study"
                icon={<GiDesk />}
                subtitle={'"A place for industry, architecture, and the meticulous plotting of grand designs."'}
            />

            <Tabs
                tabs={TABS}
                active={activeTab}
                onChange={setActiveTab}
                label="Study sections"
            />

            <TabPanel id="ledger" active={activeTab}>
                <KanbanBoard />
            </TabPanel>
            <TabPanel id="monitor" active={activeTab}>
                <StatusMonitor />
            </TabPanel>
        </div>
    );
};

export default Studio;
