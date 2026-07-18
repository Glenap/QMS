// Renders a deterministic ChartSpec (built server-side from the agent's tool
// results) as a recharts bar / line / pie. Mirrors the chart setup in
// pages/project/Analytics.tsx. Guards against empty data.

import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { ChartSpec } from '../../api/chat';

const COLORS = ['var(--blue)', 'var(--green)', 'var(--amber)', 'var(--red)', '#8b5cf6', '#06b6d4'];

export const ChatChart: React.FC<{ spec: ChartSpec }> = ({ spec }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  if (!spec.data || spec.data.length === 0 || spec.series.length === 0) return null;

  // Rasterise the chart to a PNG the user can save. html2canvas is heavy, so it's
  // imported on demand (only when they actually download).
  const download = async () => {
    if (!canvasRef.current) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(canvasRef.current, {
        scale: 2, backgroundColor: '#ffffff', logging: false,
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${spec.title.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  };

  let chart: React.ReactElement;
  if (spec.type === 'pie') {
    chart = (
      <PieChart>
        <Tooltip />
        <Legend />
        <Pie data={spec.data} dataKey={spec.series[0].key} nameKey={spec.x_key} outerRadius={70} label>
          {spec.data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    );
  } else if (spec.type === 'line') {
    chart = (
      <LineChart data={spec.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
        <XAxis dataKey={spec.x_key} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip />
        {spec.series.length > 1 && <Legend />}
        {spec.series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name}
            stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
        ))}
      </LineChart>
    );
  } else {
    chart = (
      <BarChart data={spec.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
        <XAxis dataKey={spec.x_key} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip />
        {spec.series.length > 1 && <Legend />}
        {spec.series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    );
  }

  return (
    <div className="qms-chat-chart">
      <div className="qms-chat-chart-head">
        <span className="qms-chat-chart-title">{spec.title}</span>
        <button type="button" className="qms-chat-chart-dl" onClick={download} disabled={saving}
          title="Download as PNG">
          <Download size={13} /> {saving ? '…' : 'PNG'}
        </button>
      </div>
      <div ref={canvasRef} className="qms-chat-chart-canvas">
        <ResponsiveContainer width="100%" height={200}>
          {chart}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
