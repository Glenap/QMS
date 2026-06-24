// Public, passwordless truck-fill page for RMC suppliers.
//
// Reached from the dispatch email link {FRONTEND_URL}/dispatch/fill?token=...
// The supplier reviews the order (project / grade / volume) and records the
// truck details before it leaves the plant. No login required — the token is
// the credential. See backend/app/routers/dispatch_token.py.

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layers, Truck } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { dispatchFillApi } from '../api/dispatchFill';
import { getApiErrorMessage } from '../api/client';
import type { TruckActionResult, TruckFillView } from '../types/master';
import './LoginPage.css';

const STATUS_NOTE: Record<string, string> = {
  FILLED: 'These truck details have already been submitted. Thank you!',
  ARRIVED: 'This truck has arrived at the site gate.',
  ACCEPTED: 'This delivery has been accepted at site.',
  REJECTED: 'This delivery was rejected at site.',
};

const numOrNull = (v: string): number | null => {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
};

export const DispatchFill: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<TruckFillView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TruckActionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    vehicle_number: '',
    driver_name: '',
    batch_number: '',
    challan_number: '',
    volume_cum: '',
    wc_ratio_actual: '',
    slump_at_plant_mm: '',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (!token) {
      setError('This dispatch link is invalid.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const v = await dispatchFillApi.view(token);
        if (!cancelled) setView(v);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'This dispatch link is invalid or has expired.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await dispatchFillApi.submit(token, {
        vehicle_number: form.vehicle_number.trim(),
        driver_name: form.driver_name.trim() || null,
        batch_number: form.batch_number.trim() || null,
        challan_number: form.challan_number.trim() || null,
        volume_cum: numOrNull(form.volume_cum),
        wc_ratio_actual: numOrNull(form.wc_ratio_actual),
        slump_at_plant_mm: numOrNull(form.slump_at_plant_mm),
      });
      setResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not submit the truck details. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="qms-auth-page">
      <div className="qms-auth-card" style={{ maxWidth: 480 }}>
        <div className="qms-auth-brand">
          <div className="qms-auth-mark" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
          <h1 className="qms-auth-title">Truck dispatch details</h1>
        </div>

        {loading ? (
          <p className="text-muted" style={{ textAlign: 'center' }}>Loading…</p>
        ) : result ? (
          <div className="qms-auth-error" style={{ background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' }}>
            {result.message}
          </div>
        ) : error && !view ? (
          <div className="qms-auth-error">{error}</div>
        ) : view ? (
          <>
            <p className="qms-auth-sub" style={{ marginBottom: 16 }}>
              <strong>{view.project_name ?? 'A project'}</strong> has requested{' '}
              <strong>{view.volume_ordered_cum != null ? `${view.volume_ordered_cum} m³` : ''} {view.grade_name ?? ''}</strong>{' '}
              from <strong>{view.supplier_name ?? 'your plant'}</strong>. Please record the truck details below.
            </p>

            {!view.is_editable ? (
              <div className="qms-auth-error" style={{ background: '#EFF6FF', color: '#1E40AF', borderColor: '#BFDBFE' }}>
                {STATUS_NOTE[view.status] ?? 'This dispatch is no longer editable.'}
              </div>
            ) : (
              <>
                {error && <div className="qms-auth-error">{error}</div>}
                <div className="qms-auth-form">
                  <Input label="Vehicle number" required value={form.vehicle_number} onChange={set('vehicle_number')} placeholder="e.g. KA-01-AB-1234" />
                  <Input label="Driver name" value={form.driver_name} onChange={set('driver_name')} />
                  <Input label="Batch number" value={form.batch_number} onChange={set('batch_number')} />
                  <Input label="Challan number" value={form.challan_number} onChange={set('challan_number')} />
                  <Input label="Volume in truck (m³)" type="number" step="0.1" value={form.volume_cum} onChange={set('volume_cum')} />
                  <Input label="W/C ratio (actual)" type="number" step="0.001" value={form.wc_ratio_actual} onChange={set('wc_ratio_actual')} />
                  <Input label="Slump at plant (mm)" type="number" step="1" value={form.slump_at_plant_mm} onChange={set('slump_at_plant_mm')} />

                  <Button variant="primary" fullWidth icon={<Truck size={16} />} disabled={submitting || form.vehicle_number.trim() === ''} onClick={submit}>
                    {submitting ? 'Submitting…' : 'Submit truck details'}
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="qms-auth-error">{error ?? 'This dispatch link is invalid.'}</div>
        )}
      </div>
    </div>
  );
};
