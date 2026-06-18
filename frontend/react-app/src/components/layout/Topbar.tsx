import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Plus, Bell, FolderPlus } from 'lucide-react';
import { Button } from '../ui/Button';
import './Topbar.css';

interface TopbarProps {
  title: string;
}

export const Topbar: React.FC<TopbarProps> = ({ title }) => {
  const navigate = useNavigate();

  return (
    <header className="qms-topbar">
      <div className="qms-page-title">{title}</div>
      <div className="qms-topbar-actions">
        <Button variant="outline" size="sm" icon={<FolderPlus size={14} />} onClick={() => navigate('/app/projects/new')}>
          Register project
        </Button>
        <Button variant="outline" size="sm" icon={<Download size={14} />}>
          Export
        </Button>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => navigate('/app/pours/new')}>
          New pour card
        </Button>
        
        <div className="qms-notif-btn">
          <Bell size={18} color="var(--gray-500)" />
          <div className="qms-notif-dot"></div>
        </div>
        
        <div className="qms-avatar qms-avatar--clickable">RS</div>
      </div>
    </header>
  );
};
