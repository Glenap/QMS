import React from 'react';
import './Badge.css';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'pass' | 'fail' | 'warn' | 'info' | 'pending' | 'default';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default',
  icon,
  className = '', 
  ...props 
}) => {
  return (
    <span className={`qms-badge qms-badge--${variant} ${className}`} {...props}>
      {icon && <span className="qms-badge-icon">{icon}</span>}
      {children}
    </span>
  );
};
