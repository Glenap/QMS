// Public, passwordless truck-fill page for RMC suppliers.
//
// Reached from the dispatch email link {FRONTEND_URL}/dispatch/fill?token=...
// The supplier reviews the order (project / grade / volume) and records the
// truck details before it leaves the plant. No login required — the token is
// the credential. See backend/app/routers/dispatch_token.py.

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layers, Truck } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { OcrUploadZone } from '../components/ocr/OcrUploadZone';
import { dispatchFillApi } from '../api/dispatchFill';
import { getApiErrorMessage } from '../api/client';
import { str, num } from '../lib/coerce';
import type { TruckActionResult, TruckFillView } from '../types/master';
import './LoginPage.css';

const STATUS_NOTE: Record<string, string> = {
  FILLED: 'These truck details have already been submitted. Thank you!',
  ARRIVED: 'This truck has arrived at the site gate.',
  ACCEPTED: 'This delivery has been accepted at site.',
  REJECTED: 'This delivery was rejected at site.',
};

const schema = z.object({
  vehicle_number: z.string().min(1, 'Vehicle number is required'),
  driver_name: z.string(),
  batch_number: z.string(),
  challan_number: z.string(),
  volume_cum: z.string(),
  wc_ratio_actual: z.string(),
  slump_at_plant_mm: z.string(),
});
type FormValues = z.infer<typeof schema>;

export const DispatchFill: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<TruckFillView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TruckActionResult | null>(null);

  const {
    register, handleSubmit, setValue, formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_number: '', driver_name: '', batch_number: '', challan_number: '',
      volume_cum: '', wc_ratio_actual: '', slump_at_plant_mm: '',
    },
  });

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

  const onSubmit = async (v: FormValues) => {
    setError(null);
    try {
      const res = await dispatchFillApi.submit(token, {
        vehicle_number: v.vehicle_number.trim(),
        driver_name: str(v.driver_name) ?? null,
        batch_number: str(v.batch_number) ?? null,
        challan_number: str(v.challan_number) ?? null,
        volume_cum: num(v.volume_cum) ?? null,
        wc_ratio_actual: num(v.wc_ratio_actual) ?? null,
        slump_at_plant_mm: num(v.slump_at_plant_mm) ?? null,
      });
      setResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not submit the truck details. Please try again.'));
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
                
                <div style={{ marginBottom: 16 }}>
                  <OcrUploadZone 
                    hooks={{
                      createJob: (f) => dispatchFillApi.createOcrJob(token, f as File),
                      getJob: (id) => dispatchFillApi.getOcrJob(token, id),
                    }}
                    onSuccess={(data) => {
                      if (data.vehicle_number) setValue('vehicle_number', data.vehicle_number);
                      if (data.batch_number) setValue('batch_number', data.batch_number);
                      if (data.challan_number) setValue('challan_number', data.challan_number);
                      if (data.volume_cum) setValue('volume_cum', String(data.volume_cum));
                    }}
                  />
                </div>

                <form className="qms-auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <Input label="Vehicle number" required error={errors.vehicle_number?.message} placeholder="e.g. KA-01-AB-1234" {...register('vehicle_number')} />
                  <Input label="Driver name" {...register('driver_name')} />
                  <Input label="Batch number" {...register('batch_number')} />
                  <Input label="Challan number" {...register('challan_number')} />
                  <Input label="Volume in truck (m³)" type="number" step="0.1" {...register('volume_cum')} />
                  <Input label="W/C ratio (actual)" type="number" step="0.001" {...register('wc_ratio_actual')} />
                  <Input label="Slump at plant (mm)" type="number" step="1" {...register('slump_at_plant_mm')} />

                  <Button type="submit" variant="primary" fullWidth icon={<Truck size={16} />} disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting…' : 'Submit truck details'}
                  </Button>
                </form>
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
