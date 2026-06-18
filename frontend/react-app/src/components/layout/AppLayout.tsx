import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/analytics': 'Analytics',
  '/pours/new': 'New Pour Card',
  '/results/1': 'Cube Result',
  '/trace': 'Traceability',
  '/gate': 'Gate Scan',
  '/ncr': 'Non-Conformance Report',
  '/reports': 'Reports',
  '/suppliers': 'Suppliers',
  '/labs': 'Laboratories',
  '/team': 'Team',
  '/chatbot': 'QMS Assistant',
};

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const title = routeTitles[location.pathname] || 'QMS Platform';

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Topbar title={title} />
        <main className="content-area animate-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
