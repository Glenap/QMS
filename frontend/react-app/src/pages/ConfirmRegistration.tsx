// Public, passwordless confirmation page for suppliers & labs.
//
// Reached from the email link {FRONTEND_URL}/external/confirm/{kind}?token=...
// (kind = "supplier" | "lab"). The external party reviews the details the
// contractor entered, optionally corrects their contact info, then confirms or
// declines. No login required — the token is the credential.

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { confirmationsApi } from '../api/confirmations';
import { getApiErrorMessage } from '../api/client';
import type {
  ConfirmationResult,
  LabConfirmationView,
  SupplierConfirmationView,
} from '../types/master';
import './LoginPage.css';

export const ConfirmRegistration: React.FC = () => {
  const { kind } = useParams<{ kind: string }>();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const isLab = kind === 'lab';

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierConfirmationView | null>(null);
  const [lab, setLab] = useState<LabConfirmationView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConfirmationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Editable contact fields (prefilled from the loaded record).
  const [form, setForm] = useState({
    contact_email: '',
    contact_phone: '',
    primary_contact_name: '', // supplier
    plant_location: '', // supplier
    lab_manager_name: '', // lab
    nabl_certificate_no: '', // lab
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (!token || (kind !== 'supplier' && kind !== 'lab')) {
      setError('This confirmation link is invalid.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (isLab) {
          const v = await confirmationsApi.viewLab(token);
          if (cancelled) return;
          setLab(v);
          setForm((p) => ({
            ...p,
            contact_email: v.contact_email ?? '',
            contact_phone: v.contact_phone ?? '',
            lab_manager_name: v.lab_manager_name ?? '',
          }));
        } else {
          const v = await confirmationsApi.viewSupplier(token);
          if (cancelled) return;
          setSupplier(v);
          setForm((p) => ({
            ...p,
            contact_email: v.contact_email ?? '',
            contact_phone: v.contact_phone ?? '',
            primary_contact_name: v.primary_contact_name ?? '',
            plant_location: v.plant_location ?? '',
          }));
        }
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'This confirmation link is invalid or has expired.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, kind, isLab]);

  const submit = async (action: 'CONFIRM' | 'DECLINE') => {
    setError(null);
    setSubmitting(true);
    try {
      const res = isLab
        ? await confirmationsApi.submitLab(token, {
            action,
            contact_email: form.contact_email || null,
            contact_phone: form.contact_phone || null,
            lab_manager_name: form.lab_manager_name || null,
            nabl_certificate_no: form.nabl_certificate_no || null,
          })
        : await confirmationsApi.submitSupplier(token, {
            action,
            contact_email: form.contact_email || null,
            contact_phone: form.contact_phone || null,
            primary_contact_name: form.primary_contact_name || null,
            plant_location: form.plant_location || null,
          });
      setResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not record your response. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const view = isLab ? lab : supplier;
  const name = isLab ? lab?.lab_name : supplier?.supplier_name;
  const roleLabel = isLab ? 'testing lab' : 'RMC plant';
  const alreadyResponded = view && view.status !== 'PENDING';

  return (
    <div className="qms-auth-page">
      <div className="qms-auth-card" style={{ maxWidth: 460 }}>
        <div className="qms-auth-brand">
          <div className="qms-auth-mark" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
          <h1 className="qms-auth-title">Confirm your details</h1>
        </div>

        {loading ? (
          <p className="text-muted" style={{ textAlign: 'center' }}>Loading…</p>
        ) : result ? (
          <div
            className="qms-auth-error"
            style={
              result.status === 'CONFIRMED'
                ? { background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' }
                : { background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }
            }
          >
            {result.message}
          </div>
        ) : error && !view ? (
          <div className="qms-auth-error">{error}</div>
        ) : view ? (
          <>
            <p className="qms-auth-sub" style={{ marginBottom: 16 }}>
              <strong>{view.registered_by ?? 'A contractor'}</strong> registered your {roleLabel}{' '}
              <strong>{name}</strong>
              {view.project_name ? <> for project <strong>{view.project_name}</strong></> : null} on Strata.
              Please review and confirm.
            </p>

            {alreadyResponded && (
              <div className="qms-auth-error" style={{ background: '#EFF6FF', color: '#1E40AF', borderColor: '#BFDBFE' }}>
                This registration was already marked <strong>{view.status}</strong>. You can update your response below.
              </div>
            )}
            {error && <div className="qms-auth-error">{error}</div>}

            <div className="qms-auth-form">
              <Input label="Contact email" type="email" value={form.contact_email} onChange={set('contact_email')} />
              <Input label="Contact phone" type="tel" value={form.contact_phone} onChange={set('contact_phone')} />
              {isLab ? (
                <>
                  <Input label="Lab manager name" value={form.lab_manager_name} onChange={set('lab_manager_name')} />
                  <Input label="NABL certificate no." value={form.nabl_certificate_no} onChange={set('nabl_certificate_no')} />
                </>
              ) : (
                <>
                  <Input label="Primary contact name" value={form.primary_contact_name} onChange={set('primary_contact_name')} />
                  <Input label="Plant location" value={form.plant_location} onChange={set('plant_location')} />
                </>
              )}

              <Button variant="primary" fullWidth disabled={submitting} onClick={() => submit('CONFIRM')}>
                {submitting ? 'Submitting…' : 'Confirm my details'}
              </Button>
              <Button variant="outline" fullWidth disabled={submitting} onClick={() => submit('DECLINE')}>
                This isn't us — decline
              </Button>
            </div>
          </>
        ) : (
          <div className="qms-auth-error">{error ?? 'This confirmation link is invalid.'}</div>
        )}
      </div>
    </div>
  );
};
