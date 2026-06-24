import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { initials } from '../../lib/initials';
import './Topbar.css';

interface TopbarProps {
  title: string;
}

// A clean global header — page/role-specific actions live on their own pages
// (e.g. "New Project" on the Projects list, "New pour card" in the project's
// Pour cards area), not here.
export const Topbar: React.FC<TopbarProps> = ({ title }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="qms-topbar">
      <div className="qms-page-title">{title}</div>
      <div className="qms-topbar-actions">
        <div className="qms-notif-btn">
          <Bell size={18} color="var(--gray-500)" />
          <div className="qms-notif-dot"></div>
        </div>

        <div
          className="qms-avatar qms-avatar--clickable"
          role="button"
          aria-label="View profile"
          title={user?.full_name ? `${user.full_name} — view profile` : 'View profile'}
          onClick={() => navigate('/app/profile')}
          style={user?.avatar_url ? { background: `center / cover no-repeat url(${user.avatar_url})` } : undefined}
        >
          {!user?.avatar_url && initials(user?.full_name)}
        </div>
        <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </header>
  );
};
