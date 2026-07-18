import React, { useState } from 'react';
import { NavLink, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { onActivateKey } from '../../lib/a11y';
import {
  Home,
  BarChart2,
  FileText,
  TestTube,
  Link as LinkIcon,
  Scan,
  AlertTriangle,
  Truck,
  Send,
  Building,
  Users,
  MessageCircle,
  LogOut,
  Inbox,
  Menu,
  Layers,
  Building2,
  FlaskConical,
  ClipboardCheck,
  Bell,
  LayoutDashboard,
  ShieldCheck,
  Wrench,
  Sparkles,
  Camera,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useProjectDetail } from '../../queries/projects';
import { useQEInboxCount } from '../../queries/qeInbox';
import { useAlertCount } from '../../queries/alerts';
import { initials, roleLabel } from '../../lib/initials';
import './Sidebar.css';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  show?: boolean; // default true
  badge?: number;
  end?: boolean;
}
interface NavGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const COLLAPSE_KEY = 'qms-sidebar-collapsed';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { user, organisation, logout } = useAuth();

  // The sidebar defaults to the full labelled list; the hamburger minimises it to
  // a Gmail-style icon rail. The choice is remembered — collapsed only when the
  // user has explicitly minimised it (stored '1'); anything else is expanded.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });

  // In rail (collapsed) mode, exactly one section flyout may be open at a time.
  // Driving this from state (not independent CSS :hover/:focus-within per group)
  // is what stops two tall, top-anchored flyouts from overlapping each other.
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Persist EVERY collapse/expand (not just the hamburger) so the choice survives
  // reload and navigation — otherwise expanding from the rail would revert.
  const applyCollapsed = (next: boolean) => {
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
  };
  const toggleCollapsed = () => applyCollapsed(!collapsed);

  // Detect "am I inside a project workspace?" from the URL.
  const match = useMatch('/app/projects/:projectId/*');
  const rawId = match?.params.projectId;
  const inProject = !!rawId && rawId !== 'new' && !Number.isNaN(Number(rawId));
  const base = inProject ? `/app/projects/${rawId}` : '';
  const { pathname } = useLocation();

  const isClientSide = user?.role === 'CLIENT_ADMIN' || user?.role === 'CLIENT_USER';
  const isContractorOrg =
    user?.role === 'CONTRACTOR_ADMIN' || user?.role === 'CONTRACTOR_USER';

  // Operational actions come from the caller's per-project designation, not their
  // org role — a person is a QE only on the project they're assigned to.
  const { data: projectDetail } = useProjectDetail(Number(rawId), inProject);
  const designation = projectDetail?.access.project_role ?? null;
  const isQualityEngineer = designation === 'QUALITY_ENGINEER';
  const isProjectManager = designation === 'PROJECT_MANAGER';
  const isSupervisor = designation === 'SUPERVISOR';

  // QE in-situ inbox badge (PENDING_QE deliveries), polled.
  const { data: inbox } = useQEInboxCount(Number(rawId), inProject && isQualityEngineer);
  const inboxCount = inbox?.count ?? 0;

  // Quality-alert badge (QE + PM), polled.
  const { data: alertCount } = useAlertCount(
    Number(rawId), inProject && (isQualityEngineer || isProjectManager),
  );
  const alerts = alertCount?.count ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `qms-nav-item ${isActive ? 'active' : ''}`;

  // ── Nav model ────────────────────────────────────────────────────────────────
  const rawGroups: NavGroup[] = inProject
    ? [
        {
          key: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} />,
          items: [
            { to: base, label: 'Dashboard', icon: <Home size={18} />, end: true },
            { to: `${base}/analytics`, label: 'Analytics', icon: <BarChart2 size={18} /> },
            { to: `${base}/documents`, label: 'Documents', icon: <FileText size={18} /> },
          ],
        },
        {
          key: 'operations', label: 'Operations', icon: <Truck size={20} />,
          items: [
            { to: `${base}/pours`, label: 'Pour cards', icon: <FileText size={18} />, show: isQualityEngineer },
            { to: `${base}/dispatches`, label: 'Dispatches', icon: <Send size={18} />, show: isQualityEngineer },
            { to: `${base}/cube`, label: 'Cube tests', icon: <TestTube size={18} />, show: isQualityEngineer },
            { to: `${base}/qe-inbox`, label: 'In-situ inbox', icon: <ClipboardCheck size={18} />, show: isQualityEngineer, badge: inboxCount },
            { to: `${base}/trace`, label: 'Traceability', icon: <LinkIcon size={18} /> },
            { to: `${base}/gate`, label: 'Gate scan', icon: <Scan size={18} />, show: isSupervisor },
          ],
        },
        {
          key: 'quality', label: 'Quality', icon: <ShieldCheck size={20} />,
          items: [
            { to: `${base}/ncr`, label: 'NCR', icon: <AlertTriangle size={18} /> },
            { to: `${base}/retests`, label: 'Retests', icon: <FlaskConical size={18} /> },
            { to: `${base}/conformance`, label: 'Conformance Analyser', icon: <Camera size={18} /> },
            { to: `${base}/alerts`, label: 'Alerts', icon: <Bell size={18} />, show: isQualityEngineer || isProjectManager, badge: alerts },
          ],
        },
        {
          key: 'setup', label: 'Setup', icon: <Wrench size={20} />,
          items: [
            { to: `${base}/team`, label: 'Team', icon: <Users size={18} /> },
            { to: `${base}/contractors`, label: 'Contractors', icon: <Building size={18} />, show: isClientSide },
            { to: `${base}/suppliers`, label: 'Suppliers', icon: <Truck size={18} /> },
            { to: `${base}/labs`, label: 'Laboratories', icon: <Building size={18} /> },
            { to: `${base}/floors`, label: 'Floors', icon: <Building2 size={18} /> },
            { to: `${base}/mix-designs`, label: 'Mix designs', icon: <FlaskConical size={18} /> },
          ],
        },
        {
          key: 'ai', label: 'AI', icon: <Sparkles size={20} />,
          items: [
            { to: `${base}/chatbot`, label: 'Strata assistant', icon: <MessageCircle size={18} /> },
          ],
        },
      ]
    : [
        {
          key: 'workspace', label: 'Workspace', icon: <Building size={20} />,
          items: [
            { to: '/app/projects', label: 'Projects', icon: <Building size={18} />, end: true },
            { to: '/app/assigned', label: 'Assigned', icon: <Inbox size={18} />, show: isContractorOrg },
            { to: '/app/team', label: 'Team', icon: <Users size={18} /> },
            { to: '/app/suppliers', label: 'RMC Suppliers', icon: <Truck size={18} /> },
            { to: '/app/labs', label: 'Laboratories', icon: <FlaskConical size={18} /> },
          ],
        },
      ];

  const groups = rawGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => it.show !== false) }))
    .filter((g) => g.items.length > 0);

  const itemActive = (it: NavItem): boolean =>
    it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(`${it.to}/`);
  const activeKey = groups.find((g) => g.items.some(itemActive))?.key ?? null;

  const subItem = (it: NavItem) => (
    <NavLink key={it.to} end={it.end} to={it.to} className={itemClass}>
      {it.icon} {it.label}
      {(it.badge ?? 0) > 0 && <span className="qms-nav-badge">{it.badge}</span>}
    </NavLink>
  );

  return (
    <aside className={`qms-sidebar ${collapsed ? 'qms-sidebar-collapsed' : ''}`}>
      <div className="qms-sidebar-top">
        <div className="qms-sidebar-toprow">
          <button
            type="button"
            className="qms-sidebar-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <Menu size={20} />
          </button>
          {!collapsed && (
            <div className="qms-logo">
              <div className="qms-logo-icon"><Layers size={18} /></div>
              <div>
                <div className="qms-logo-text">Strata</div>
                <div className="qms-logo-sub">Concrete QMS</div>
              </div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="qms-project-badge">
            {organisation?.org_name ?? 'Your organisation'}
            <span>{roleLabel(user?.role) || '—'}</span>
          </div>
        )}
      </div>

      <nav className={`qms-nav ${collapsed ? 'qms-nav-rail' : ''}`}>
        {collapsed
          ? groups.map((g) => {
              const groupBadge = g.items.reduce((n, it) => n + (it.badge ?? 0), 0);
              return (
                <div
                  key={g.key}
                  className={`qms-rail-group ${openKey === g.key ? 'is-open' : ''}`}
                  onMouseEnter={() => setOpenKey(g.key)}
                  onMouseLeave={() => setOpenKey((k) => (k === g.key ? null : k))}
                  onFocus={() => setOpenKey(g.key)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setOpenKey((k) => (k === g.key ? null : k));
                    }
                  }}
                >
                  <button
                    type="button"
                    className={`qms-rail-item ${activeKey === g.key ? 'is-active' : ''}`}
                    onClick={() => applyCollapsed(false)}
                    title={g.label}
                  >
                    <span className="qms-rail-icon">
                      {g.icon}
                      {groupBadge > 0 && <span className="qms-rail-badge">{groupBadge}</span>}
                    </span>
                    <span className="qms-rail-label">{g.label}</span>
                  </button>
                  <div className="qms-rail-flyout" role="menu">
                    <div className="qms-rail-flyout-title">{g.label}</div>
                    {g.items.map(subItem)}
                  </div>
                </div>
              );
            })
          : groups.map((g) => (
              <div key={g.key} className="qms-nav-group">
                <div className="qms-nav-section">{g.label}</div>
                {g.items.map(subItem)}
              </div>
            ))}
      </nav>

      <div className="qms-sidebar-bottom">
        <div className="qms-user-row">
          <div
            className="qms-avatar"
            role="button"
            tabIndex={0}
            aria-label="View profile"
            title="View profile"
            onClick={() => navigate('/app/profile')}
            onKeyDown={onActivateKey(() => navigate('/app/profile'))}
            style={
              user?.avatar_url
                ? { background: `center / cover no-repeat url(${user.avatar_url})`, cursor: 'pointer' }
                : { cursor: 'pointer' }
            }
          >
            {!user?.avatar_url && initials(user?.full_name)}
          </div>
          {!collapsed && (
            <div
              role="button"
              tabIndex={0}
              aria-label="View profile"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/app/profile')}
              onKeyDown={onActivateKey(() => navigate('/app/profile'))}
            >
              <div className="qms-user-name">{user?.full_name ?? 'Not signed in'}</div>
              <div className="qms-user-role">{roleLabel(user?.role)}</div>
            </div>
          )}
          <LogOut
            size={16}
            className="qms-settings-icon"
            role="button"
            tabIndex={0}
            aria-label="Log out"
            onClick={handleLogout}
            onKeyDown={onActivateKey(handleLogout)}
            style={{ cursor: 'pointer' }}
          />
        </div>
      </div>
    </aside>
  );
};
