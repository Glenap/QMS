// Email OTP verification — the activation step after signup / invite-accept.
// The email to verify arrives via router state ({ email }) or a ?email= query
// param. On success the user is logged in and sent to the app.

import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../api/client';
import './LoginPage.css';

export const VerifyOtpPage: React.FC = () => {
  const { isAuthenticated, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const email = (location.state as { email?: string } | null)?.email ?? params.get('email') ?? '';

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  // No email to verify — send them back to start.
  if (!email) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await verifyOtp(email, code.trim());
      navigate('/app', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'That code is invalid or has expired.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await resendOtp(email);
      setNotice('A new code has been sent to your email.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not resend the code. Please try again.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="qms-auth-page">
      <div className="qms-auth-card">
        <div className="qms-auth-brand">
          <div className="qms-auth-mark">S</div>
          <h1 className="qms-auth-title">Verify your email</h1>
          <p className="qms-auth-sub">
            Enter the 6-digit code we sent to <strong>{email}</strong>
          </p>
        </div>

        <form className="qms-auth-form" onSubmit={handleSubmit}>
          {error && <div className="qms-auth-error">{error}</div>}
          {notice && (
            <div className="qms-auth-error" style={{ background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' }}>
              {notice}
            </div>
          )}

          <Input
            label="Verification code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            style={{ letterSpacing: 6, fontSize: 18 }}
          />

          <Button type="submit" variant="primary" fullWidth disabled={submitting || code.length < 4}>
            {submitting ? 'Verifying…' : 'Verify & continue'}
          </Button>
        </form>

        <div className="qms-auth-switch">
          Didn't get a code?
          <button type="button" onClick={handleResend} disabled={resending}>
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        </div>
        {/* Registration deliberately can't say whether an address already has an
            account (that would let anyone test which emails are registered), so
            an existing user lands here waiting for a code that won't arrive.
            This is the generic hint that points them at the right door. */}
        <p className="qms-auth-note">
          Already have an account with this email? We've emailed you a note
          instead — <Link to="/login">sign in</Link>.
        </p>
      </div>
    </div>
  );
};
