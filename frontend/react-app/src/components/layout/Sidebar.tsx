import React from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import {
  Home,
  BarChart2,
  FileText,
  TestTube,
  Link as LinkIcon,
  Scan,
  AlertTriangle,
  CheckSquare,
  Truck,
  Send,
  Building,
  Users,
  MessageCircle,
  LogOut,
  Inbox,
  ChevronLeft,
  Layers,
  Building2,
  FlaskConical,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { initials, roleLabel } from '../../lib/initials';
import './Sidebar.css';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { user, organisation, logout } = useAuth();

  // Detect "am I inside a project workspace?" from the URL.
  const match = useMatch('/app/projects/:projectId/*');
  const rawId = match?.params.projectId;
  const inProject = !!rawId && rawId !== 'new' && !Number.isNaN(Number(rawId));
  const base = inProject ? `/app/projects/${rawId}` : '';

  const isClientSide = user?.role === 'CLIENT_ADMIN' || user?.role === 'CLIENT_USER';
  const isAdmin = user?.role === 'CLIENT_ADMIN' || user?.role === 'CONTRACTOR_ADMIN';
  const isContractorOrg =
    user?.role === 'CONTRACTOR_ADMIN' || user?.role === 'CONTRACTOR_USER';
  // Operational actions are role-specific.
  const isQualityEngineer = user?.role === 'QUALITY_ENGINEER';
  const isSupervisor = user?.role === 'SUPERVISOR';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const item = ({ isActive }: { isActive: boolean }) =>
    `qms-nav-item ${isActive ? 'active' : ''}`;

  return (
    <aside className="qms-sidebar">
      <div className="qms-sidebar-top">
        <div className="qms-logo">
          <div className="qms-logo-icon"><Layers size={18} /></div>
          <div>
            <div className="qms-logo-text">Strata</div>
            <div className="qms-logo-sub">Concrete QMS</div>
          </div>
        </div>
        <div className="qms-project-badge">
          {organisation?.org_name ?? 'Your organisation'}
          <span>{roleLabel(user?.role) || '—'}</span>
        </div>
      </div>

      {inProject ? (
        <nav className="qms-nav">
          {isAdmin && (
            <NavLink to="/app/projects" className="qms-nav-item" style={{ marginBottom: 8 }}>
              <ChevronLeft size={18} /> All projects
            </NavLink>
          )}

          <div className="qms-nav-section">Overview</div>
          <NavLink end to={base} className={item}><Home size={18} /> Dashboard</NavLink>
          <NavLink to={`${base}/analytics`} className={item}><BarChart2 size={18} /> Analytics</NavLink>
          <NavLink to={`${base}/documents`} className={item}><FileText size={18} /> Documents</NavLink>

          <div className="qms-nav-section">Operations</div>
          {isQualityEngineer && (
            <NavLink to={`${base}/pours`} className={item}><FileText size={18} /> Pour cards</NavLink>
          )}
          {isQualityEngineer && (
            <NavLink to={`${base}/dispatches`} className={item}><Send size={18} /> Dispatches</NavLink>
          )}
          {isQualityEngineer && (
            <NavLink to={`${base}/cube`} className={item}><TestTube size={18} /> Cube tests</NavLink>
          )}
          <NavLink to={`${base}/trace`} className={item}><LinkIcon size={18} /> Traceability</NavLink>
          {isSupervisor && (
            <NavLink to={`${base}/gate`} className={item}><Scan size={18} /> Gate scan</NavLink>
          )}

          <div className="qms-nav-section">Quality</div>
          <NavLink to={`${base}/ncr`} className={item}><AlertTriangle size={18} /> NCR</NavLink>
          <NavLink to={`${base}/audits`} className={item}><CheckSquare size={18} /> Audits</NavLink>

          <div className="qms-nav-section">Setup</div>
          <NavLink to={`${base}/team`} className={item}><Users size={18} /> Team</NavLink>
          {isClientSide && (
            <NavLink to={`${base}/contractors`} className={item}><Building size={18} /> Contractors</NavLink>
          )}
          <NavLink to={`${base}/suppliers`} className={item}><Truck size={18} /> Suppliers</NavLink>
          <NavLink to={`${base}/labs`} className={item}><Building size={18} /> Laboratories</NavLink>
          <NavLink to={`${base}/floors`} className={item}><Building2 size={18} /> Floors</NavLink>
          <NavLink to={`${base}/mix-designs`} className={item}><FlaskConical size={18} /> Mix designs</NavLink>

          <div className="qms-nav-section">AI</div>
          <NavLink to={`${base}/chatbot`} className={item}><MessageCircle size={18} /> Strata assistant</NavLink>
        </nav>
      ) : (
        <nav className="qms-nav">
          <div className="qms-nav-section">Workspace</div>
          <NavLink end to="/app/projects" className={item}><Building size={18} /> Projects</NavLink>
          {isContractorOrg && (
            <NavLink to="/app/assigned" className={item}><Inbox size={18} /> Assigned</NavLink>
          )}
          <div style={{ padding: '16px 12px', fontSize: 13, color: 'var(--gray-500)' }}>
            Open a project to see its dashboard, analytics, team, suppliers and more.
          </div>
        </nav>
      )}

      <div className="qms-sidebar-bottom">
        <div className="qms-user-row">
          <div
            className="qms-avatar"
            role="button"
            aria-label="View profile"
            title="View profile"
            onClick={() => navigate('/app/profile')}
            style={
              user?.avatar_url
                ? { background: `center / cover no-repeat url(${user.avatar_url})`, cursor: 'pointer' }
                : { cursor: 'pointer' }
            }
          >
            {!user?.avatar_url && initials(user?.full_name)}
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/app/profile')}>
            <div className="qms-user-name">{user?.full_name ?? 'Not signed in'}</div>
            <div className="qms-user-role">{roleLabel(user?.role)}</div>
          </div>
          <LogOut
            size={16}
            className="qms-settings-icon"
            role="button"
            aria-label="Log out"
            onClick={handleLogout}
            style={{ cursor: 'pointer' }}
          />
        </div>
      </div>
    </aside>
  );
};
