// Project workspace shell: loads a project's detail (+ viewer capabilities),
// shows a compact header, and exposes the project/access to the nested pages
// via the router Outlet context. The nav itself lives in the (project-aware)
// Sidebar.

import React from 'react';
import { Link, Outlet, useMatch, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { ErrorBox } from '../ui/ErrorBox';
import { ChatWidget } from '../chat/ChatWidget';
import { getApiErrorMessage } from '../../api/client';
import { useProjectDetail } from '../../queries/projects';
import type { ProjectDetail } from '../../types/master';
import './ProjectLayout.css';

export interface ProjectCtx {
  project: ProjectDetail;
  reload: () => void;
}

// Tab pages call this to read the loaded project + a reload callback.
// (Co-located with the layout on purpose; HMR fast-refresh isn't a concern here.)
// eslint-disable-next-line react-refresh/only-export-components
export const useProject = () => useOutletContext<ProjectCtx>();

const STATUS_VARIANT: Record<string, 'pass' | 'warn' | 'info'> = {
  ACTIVE: 'pass',
  ON_HOLD: 'warn',
  COMPLETED: 'info',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
};

export const ProjectLayout: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const id = Number(projectId);
  // The full Chatbot page already hosts the analyst — don't also float the widget
  // there (it would be a second conversation on the same project).
  const onChatbotPage = useMatch('/app/projects/:projectId/chatbot') != null;

  const { data: project, isPending, error, refetch } = useProjectDetail(id);

  if (isPending) {
    return <div className="qms-form-page"><p className="text-muted">Loading project…</p></div>;
  }
  if (error || !project) {
    return (
      <div className="qms-form-page">
        <button type="button" className="qms-pw-back" onClick={() => navigate('/app/projects')}>
          <ChevronLeft size={16} /> Back to projects
        </button>
        <ErrorBox>{error ? getApiErrorMessage(error, 'Unable to load this project.') : 'Project not found.'}</ErrorBox>
      </div>
    );
  }

  return (
    <div className="qms-form-page">
      <div className="qms-pw">
        <div className="qms-pw-header">
          <div>
            <Link to={`/app/projects/${id}`} className="qms-pw-title-link" title="Go to project dashboard">
              <h1 className="qms-pw-title">{project.project_name}</h1>
            </Link>
            <div className="qms-pw-sub">
              {project.project_code ? `${project.project_code} · ` : ''}
              {[project.city, project.state].filter(Boolean).join(', ') || 'No location set'}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[project.status] ?? 'default'}>
            {STATUS_LABEL[project.status] ?? project.status}
          </Badge>
        </div>

        <Outlet context={{ project, reload: () => { void refetch(); } } satisfies ProjectCtx} />
      </div>
      {!onChatbotPage && <ChatWidget project={project} />}
    </div>
  );
};
