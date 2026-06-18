import React, { useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ChevronRight, Search, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import './Traceability.css';

const records = [
  {
    id: 'C-047',
    status: 'pass',
    pourCard: 'PC-T1-5F-SLB-20240601-001',
    location: 'T1 · 5F · Slab',
    grade: 'M40',
    supplier: 'UltraTech RMC',
    challan: 'CH-20240601-089',
    truck: 'KA-05-AB-1234',
    castDate: '01-Jun-2024',
    cubeID: 'CUBE-T1-5F-20240601-001',
    lab: 'ENVTECH',
    strength: '48.3 MPa',
    testDate: '29-Jun-2024',
    ncr: null,
  },
  {
    id: 'C-048',
    status: 'fail',
    pourCard: 'PC-T1-5F-SLB-20240601-001',
    location: 'T1 · 5F · Slab',
    grade: 'M40',
    supplier: 'UltraTech RMC',
    challan: 'CH-20240601-089',
    truck: 'KA-05-AB-1240',
    castDate: '01-Jun-2024',
    cubeID: 'CUBE-T1-5F-20240601-002',
    lab: 'ENVTECH',
    strength: '37.2 MPa',
    testDate: '29-Jun-2024',
    ncr: 'NCR-2024-015',
  },
  {
    id: 'C-051',
    status: 'pending',
    pourCard: 'PC-T3-1F-RAF-20240625-003',
    location: 'T3 · 1F · Raft',
    grade: 'M25',
    supplier: 'UltraTech RMC',
    challan: 'CH-20240625-102',
    truck: 'KA-05-AB-1259',
    castDate: '25-Jun-2024',
    cubeID: 'CUBE-T3-1F-20240625-001',
    lab: 'ENVTECH',
    strength: '—',
    testDate: 'Due 2-Jul-2024',
    ncr: null,
  },
];

const statusConfig: Record<string, { label: string; variant: 'pass' | 'fail' | 'pending'; icon: React.ReactNode }> = {
  pass: { label: 'PASS', variant: 'pass', icon: <CheckCircle size={12} /> },
  fail: { label: 'FAIL', variant: 'fail', icon: <XCircle size={12} /> },
  pending: { label: 'PENDING', variant: 'pending', icon: <Clock size={12} /> },
};

export const Traceability: React.FC = () => {
  const [selected, setSelected] = useState<typeof records[0] | null>(records[0]);
  const [query, setQuery] = useState('');

  const filtered = records.filter(r =>
    r.id.toLowerCase().includes(query.toLowerCase()) ||
    r.location.toLowerCase().includes(query.toLowerCase()) ||
    r.pourCard.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="qms-trace-page">
      <div className="qms-trace-left">
        <div className="qms-trace-search">
          <Search size={16} className="qms-search-icon" />
          <input
            type="text"
            placeholder="Search by Cube ID, Pour Card, Location…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="qms-search-input"
          />
        </div>

        <div className="qms-trace-list">
          {filtered.map(r => {
            const cfg = statusConfig[r.status];
            return (
              <div
                key={r.id}
                className={`qms-trace-item ${selected?.id === r.id ? 'qms-trace-item--active' : ''}`}
                onClick={() => setSelected(r)}
              >
                <div className="qms-trace-item-top">
                  <span className="font-medium">{r.id}</span>
                  <Badge variant={cfg.variant} icon={cfg.icon}>{cfg.label}</Badge>
                </div>
                <div className="qms-trace-item-sub">{r.location} · {r.grade}</div>
                <div className="qms-trace-item-sub text-muted">{r.castDate}</div>
                <ChevronRight size={16} className="qms-trace-arrow" />
              </div>
            );
          })}
        </div>
      </div>

      <div className="qms-trace-right">
        {selected ? (
          <>
            <div className="qms-trace-detail-header">
              <div>
                <h2 className="qms-trace-id">{selected.id}</h2>
                <div className="text-muted" style={{ fontSize: 13 }}>{selected.location} · {selected.grade}</div>
              </div>
              <Badge variant={statusConfig[selected.status].variant} icon={statusConfig[selected.status].icon}>
                {statusConfig[selected.status].label}
              </Badge>
            </div>

            {/* Chain visualization */}
            <div className="qms-chain">
              <div className="qms-chain-step qms-chain-step--done">
                <div className="qms-chain-dot"></div>
                <div className="qms-chain-content">
                  <div className="qms-chain-label">RMC Order & Challan</div>
                  <div className="qms-chain-val">{selected.challan}</div>
                  <div className="qms-chain-meta">Truck: {selected.truck} · Supplier: {selected.supplier}</div>
                </div>
              </div>
              <div className="qms-chain-line"></div>

              <div className="qms-chain-step qms-chain-step--done">
                <div className="qms-chain-dot"></div>
                <div className="qms-chain-content">
                  <div className="qms-chain-label">Gate Scan & Acceptance</div>
                  <div className="qms-chain-val">Entry recorded at site gate</div>
                  <div className="qms-chain-meta">Cast Date: {selected.castDate}</div>
                </div>
              </div>
              <div className="qms-chain-line"></div>

              <div className="qms-chain-step qms-chain-step--done">
                <div className="qms-chain-dot"></div>
                <div className="qms-chain-content">
                  <div className="qms-chain-label">Pour Card</div>
                  <div className="qms-chain-val">{selected.pourCard}</div>
                  <div className="qms-chain-meta">Pre-pour checklist: Approved</div>
                </div>
              </div>
              <div className="qms-chain-line"></div>

              <div className="qms-chain-step qms-chain-step--done">
                <div className="qms-chain-dot"></div>
                <div className="qms-chain-content">
                  <div className="qms-chain-label">Cube Sampling</div>
                  <div className="qms-chain-val">{selected.cubeID}</div>
                  <div className="qms-chain-meta">Dispatched to {selected.lab}</div>
                </div>
              </div>
              <div className="qms-chain-line"></div>

              <div className={`qms-chain-step ${selected.status === 'pending' ? 'qms-chain-step--pending' : selected.status === 'pass' ? 'qms-chain-step--done' : 'qms-chain-step--fail'}`}>
                <div className="qms-chain-dot"></div>
                <div className="qms-chain-content">
                  <div className="qms-chain-label">28-Day Test Result</div>
                  <div className="qms-chain-val">{selected.strength}</div>
                  <div className="qms-chain-meta">{selected.testDate} · {selected.lab}</div>
                </div>
              </div>

              {selected.ncr && (
                <>
                  <div className="qms-chain-line qms-chain-line--danger"></div>
                  <div className="qms-chain-step qms-chain-step--fail">
                    <div className="qms-chain-dot"></div>
                    <div className="qms-chain-content">
                      <div className="qms-chain-label">NCR Raised</div>
                      <div className="qms-chain-val" style={{ color: 'var(--red)' }}>{selected.ncr}</div>
                      <div className="qms-chain-meta">High severity · Open · CAPA pending</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="qms-trace-actions">
              <Button variant="outline" size="sm">View Pour Card</Button>
              <Button variant="outline" size="sm">View Lab Report</Button>
              {selected.ncr && <Button variant="danger" size="sm" icon={<AlertTriangle size={14} />}>Open NCR</Button>}
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
