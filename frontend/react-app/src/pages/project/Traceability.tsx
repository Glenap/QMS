import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { CheckCircle, ChevronRight, Clock, Search, XCircle } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useTraceDetail, useTraceSearch } from '../../queries/traceability';
import type { TraceDetail } from '../../types/master';
import './Traceability.css';

type BadgeVariant = 'pass' | 'fail' | 'pending';

const RESULT_CFG: Record<string, { variant: BadgeVariant; label: string; icon: React.ReactNode }> = {
  PASS: { variant: 'pass', label: 'PASS', icon: <CheckCircle size={12} /> },
  FAIL: { variant: 'fail', label: 'FAIL', icon: <XCircle size={12} /> },
  CRITICAL_FAILURE: { variant: 'fail', label: 'CRITICAL', icon: <XCircle size={12} /> },
  PENDING: { variant: 'pending', label: 'PENDING', icon: <Clock size={12} /> },
};
const resultCfg = (status: string | null) => RESULT_CFG[status ?? 'PENDING'] ?? RESULT_CFG.PENDING;

const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString() : '—');
const titleCase = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

const recordLabel = (r: { sample_reference: string | null; sample_id: number }) =>
  r.sample_reference ?? `Sample #${r.sample_id}`;
const locationOf = (x: { tower_name: string | null; floor_label: string | null; component_type: string | null }) =>
  [x.tower_name, x.floor_label, x.component_type].filter(Boolean).join(' · ') || '—';

interface ChainStep {
  tone: 'done' | 'fail' | 'pending';
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  danger?: boolean; // marks the connecting line above as a failure branch
}

function buildChain(d: TraceDetail): ChainStep[] {
  const steps: ChainStep[] = [];

  if (d.trucks.length > 0) {
    steps.push({
      tone: 'done',
      label: 'RMC Supply & Challan',
      value: d.trucks
        .map((t) => t.challan_number || t.vehicle_number || `Truck ${t.dispatch_token_id}`)
        .join(', '),
      meta: `${d.trucks.length} truck${d.trucks.length > 1 ? 's' : ''} · ${d.supplier_name ?? '—'}`,
    });
  }

  steps.push({
    tone: 'done',
    label: 'Pour Card',
    value: d.pour_reference ?? `Pour #${d.pour_id}`,
    meta: [locationOf(d), d.grade_name, d.volume_cum != null ? `${d.volume_cum} m³` : null, titleCase(d.pour_status)]
      .filter(Boolean)
      .join(' · '),
  });

  steps.push({
    tone: 'done',
    label: 'Cube Sampling',
    value: recordLabel(d),
    meta: [fmtDate(d.cast_date), d.lab_name].filter(Boolean).join(' · '),
  });

  if (d.tests.length === 0) {
    steps.push({ tone: 'pending', label: 'Strength Test', value: 'Awaiting result', meta: 'No test recorded yet' });
  }
  for (const t of d.tests) {
    const cfg = resultCfg(t.result_status);
    steps.push({
      tone: t.result_status === 'PASS' ? 'done' : t.result_status === 'PENDING' ? 'pending' : 'fail',
      label: `${t.test_age_days}-Day Test`,
      value: `${t.observed_strength_mpa} / ${t.required_strength_mpa} MPa`,
      meta: [fmtDate(t.test_date), cfg.label, t.lab_name].filter(Boolean).join(' · '),
    });
    if (t.ncr_number) {
      steps.push({
        tone: 'fail',
        danger: true,
        label: 'NCR Raised',
        value: t.ncr_number,
        meta: 'Non-conformance · see NCR dashboard',
      });
    }
  }
  return steps;
}

export const Traceability: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;

  // A ?q= param (e.g. from a run-chart point) pre-fills the search so the linked
  // cube is found and auto-selected.
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Debounced search — empty query returns the project's most recent samples.
  const debouncedQuery = useDebouncedValue(query, 250);
  const { data: records = [] } = useTraceSearch(pid, debouncedQuery);
  const { data: detail = null } = useTraceDetail(pid, selectedId);

  // Keep the selection valid as the result set changes (default to the first).
  useEffect(() => {
    setSelectedId((cur) =>
      cur != null && records.some((r) => r.sample_id === cur) ? cur : records[0]?.sample_id ?? null,
    );
  }, [records]);

  const selected = records.find((r) => r.sample_id === selectedId) ?? null;
  const chain: ReturnType<typeof buildChain> = detail ? buildChain(detail as TraceDetail) : [];

  return (
    <div className="qms-trace-page">
      <div className="qms-trace-left">
        <div className="qms-trace-search">
          <Search size={16} className="qms-search-icon" />
          <input
            type="text"
            placeholder="Search by cube, pour, NCR, challan or vehicle…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="qms-search-input"
          />
        </div>

        <div className="qms-trace-list">
          {records.length === 0 && (
            <p className="text-muted" style={{ fontSize: 13, padding: '12px 4px' }}>
              No records match your search.
            </p>
          )}
          {records.map((r) => {
            const cfg = resultCfg(r.result_status);
            return (
              <div
                key={r.sample_id}
                role="button"
                tabIndex={0}
                className={`qms-trace-item ${selectedId === r.sample_id ? 'qms-trace-item--active' : ''}`}
                onClick={() => setSelectedId(r.sample_id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(r.sample_id); } }}
              >
                <div className="qms-trace-item-top">
                  <span className="font-medium">{recordLabel(r)}</span>
                  <Badge variant={cfg.variant} icon={cfg.icon}>{cfg.label}</Badge>
                </div>
                <div className="qms-trace-item-sub">{locationOf(r)}{r.grade_name ? ` · ${r.grade_name}` : ''}</div>
                <div className="qms-trace-item-sub text-muted">
                  {fmtDate(r.cast_date)}{r.ncr_number ? ` · ${r.ncr_number}` : ''}
                </div>
                <ChevronRight size={16} className="qms-trace-arrow" />
              </div>
            );
          })}
        </div>
      </div>

      <div className="qms-trace-right">
        {selected && detail ? (
          <>
            <div className="qms-trace-detail-header">
              <div>
                <h2 className="qms-trace-id">{recordLabel(detail)}</h2>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  {locationOf(detail)}{detail.grade_name ? ` · ${detail.grade_name}` : ''}
                </div>
              </div>
              <Badge variant={resultCfg(selected.result_status).variant} icon={resultCfg(selected.result_status).icon}>
                {resultCfg(selected.result_status).label}
              </Badge>
            </div>

            <div className="qms-chain">
              {chain.map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div className={`qms-chain-line ${s.danger ? 'qms-chain-line--danger' : ''}`} />}
                  <div className={`qms-chain-step qms-chain-step--${s.tone}`}>
                    <div className="qms-chain-dot" />
                    <div className="qms-chain-content">
                      <div className="qms-chain-label">{s.label}</div>
                      <div className="qms-chain-val" style={s.danger ? { color: 'var(--red)' } : undefined}>{s.value}</div>
                      {s.meta && <div className="qms-chain-meta">{s.meta}</div>}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </>
        ) : (
          <div className="qms-trace-empty">
            <Search size={40} className="text-muted" />
            <p>Select a record to view its full traceability chain</p>
          </div>
        )}
      </div>
    </div>
  );
};
