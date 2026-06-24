// Project workspace shell: loads a project's detail (+ viewer capabilities),
// shows a compact header, and exposes the project/access to the nested pages
// via the router Outlet context. The nav itself lives in the (project-aware)
// Sidebar.

import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { projectsApi } from '../../api/projects';
import { getApiErrorMessage } from '../../api/client';
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

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProject(await projectsApi.detail(id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load this project.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="qms-form-page"><p className="text-muted">Loading project…</p></div>;
  }
  if (error || !project) {
    return (
      <div className="qms-form-page">
        <button className="qms-pw-back" onClick={() => navigate('/app/projects')}>
          <ChevronLeft size={16} /> Back to projects
        </button>
        <div style={{ padding: '12px 16px', borderRadius: 8, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', fontSize: 14 }}>
          {error ?? 'Project not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="qms-form-page">
      <div className="qms-pw">
        <div className="qms-pw-header">
          <div>
            <h1 className="qms-pw-title">{project.project_name}</h1>
            <div className="qms-pw-sub">
              {project.project_code ? `${project.project_code} · ` : ''}
              {[project.city, project.state].filter(Boolean).join(', ') || 'No location set'}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[project.status] ?? 'default'}>
            {STATUS_LABEL[project.status] ?? project.status}
          </Badge>
        </div>

        <Outlet context={{ project, reload: load } satisfies ProjectCtx} />
      </div>
    </div>
  );
};
