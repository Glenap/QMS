// A row of headline KPI cells. Shared by the dashboard (whole-project values)
// and the Analytics page (values derived from the active tower/grade/date
// filters) so the two read identically.

import React from 'react';
import './KpiStrip.css';

export interface KpiItem {
  label: string;
  value: string;
  color?: string;
}

export const KpiStrip: React.FC<{ items: KpiItem[] }> = ({ items }) => (
  <div className="qms-kpi-strip">
    {items.map((k) => (
      <div key={k.label} className="qms-kpi-strip-cell">
        <div className="qms-kpi-strip-val" style={k.color ? { color: k.color } : undefined}>{k.value}</div>
        <div className="qms-kpi-strip-label">{k.label}</div>
      </div>
    ))}
  </div>
);
