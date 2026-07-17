import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ConfirmProvider } from '../ui/ConfirmDialog';

// Page fallback shown while a lazy route chunk loads. Kept INSIDE the shell so
// the sidebar/topbar stay mounted (navigating a lazy page must not remount the
// whole app — that caused a layout flash/gap that only cleared on reload).
const ContentFallback = () => (
  <div style={{ padding: 24, color: 'var(--gray-500)', fontSize: 14 }}>Loading…</div>
);

const SEGMENT_TITLES: Record<string, string> = {
  projects: 'Projects',
  assigned: 'Assigned Projects',
  team: 'Team',
  contractors: 'Contractors',
  suppliers: 'Suppliers',
  labs: 'Laboratories',
  analytics: 'Analytics',
  documents: 'Documents',
  trace: 'Traceability',
  'qe-inbox': 'In-situ Inbox',
  alerts: 'Quality Alerts',
  gate: 'Gate Scan',
  ncr: 'NCR',
  chatbot: 'Strata Assistant',
  results: 'Cube Result',
};

function deriveTitle(pathname: string): string {
  const segs = pathname.split('/').filter(Boolean); // e.g. ['app','projects','5','team']
  if (pathname.includes('/pours')) return 'New Pour Card';
  if (pathname.endsWith('/projects/new')) return 'New Project';
  const last = segs[segs.length - 1] ?? '';
  if (SEGMENT_TITLES[last]) return SEGMENT_TITLES[last];
  if (/^\d+$/.test(last)) return 'Project'; // /app/projects/:id (overview)
  return 'Workspace';
}

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const title = deriveTitle(location.pathname);

  return (
    <ConfirmProvider>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Topbar title={title} />
          <main className="content-area animate-in">
            <Suspense fallback={<ContentFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </ConfirmProvider>
  );
};
