import React, { useState } from 'react';
import KanbanBoard from '../components/KanbanBoard';
import StatusMonitor from '../components/StatusMonitor';
import Curator from '../components/Curator';
import { GiTiedScroll, GiSatelliteCommunication, GiScrollUnfurled, GiDesk } from 'react-icons/gi';
import { PageHeader, Tabs, TabPanel } from '../components/ui';

/* The Curator came in from a room of its own. A news wire set once in
   January and never reopened did not deserve a place in the rail; it does
   deserve a place beside the other things the Study keeps an eye on. */
const TABS = [
    { id: 'ledger', label: 'The Ledger', icon: <GiTiedScroll /> },
    { id: 'monitor', label: 'The Monitor', icon: <GiSatelliteCommunication /> },
    { id: 'curator', label: 'The Curator', icon: <GiScrollUnfurled /> }
];

const Studio = () => {
    const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'monitor' | 'curator'

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
            <TabPanel id="curator" active={activeTab}>
                <Curator />
            </TabPanel>
        </div>
    );
};

export default Studio;
