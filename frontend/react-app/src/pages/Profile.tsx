// Profile — any signed-in user can view their details and set/clear a profile
// picture. The image is resized to a small thumbnail in the browser and stored
// as a data: URL (PUT /auth/me/avatar), so there's no file storage to manage.

import React, { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth';
import { getApiErrorMessage } from '../api/client';
import { initials, roleLabel } from '../lib/initials';

// Draw the picked image onto a canvas, capped at 256px, and return a compact
// JPEG data URL — keeps the stored string well under the server's size cap.
const MAX_DIM = 256;
function fileToThumbnailDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process the image'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const Profile: React.FC = () => {
  const { user, organisation, refreshMe } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToThumbnailDataUrl(file);
      await authApi.updateAvatar(dataUrl);
      await refreshMe();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update your photo.'));
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    setError(null);
    setBusy(true);
    try {
      await authApi.updateAvatar(null);
      await refreshMe();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not remove your photo.'));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100, #f1f5f9)' }}>
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="qms-page-header-block">
        <div>
          <h2 className="qms-section-heading-plain">My profile</h2>
          <p className="qms-page-subtitle">Your account details and profile picture</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          {error}
        </div>
      )}

      <Card className="qms-form-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            aria-label="Profile picture"
            style={{
              width: 88, height: 88, borderRadius: '50%', flexShrink: 0,
              background: user.avatar_url ? `center / cover no-repeat url(${user.avatar_url})` : 'var(--blue, #1A56DB)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700,
            }}
          >
            {!user.avatar_url && initials(user.full_name)}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
            <Button variant="primary" icon={<Camera size={16} />} disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Saving…' : user.avatar_url ? 'Change photo' : 'Upload photo'}
            </Button>
            {user.avatar_url && (
              <Button variant="ghost" icon={<Trash2 size={16} />} disabled={busy} onClick={removePhoto} style={{ marginLeft: 8 }}>
                Remove
              </Button>
            )}
            <p className="qms-text-sm text-muted" style={{ marginTop: 8 }}>
              JPG or PNG. The image is resized to a small thumbnail automatically.
            </p>
          </div>
        </div>
      </Card>

      <Card className="qms-form-section">
        <h3 className="qms-section-heading-plain" style={{ marginBottom: 8 }}>Account</h3>
        {field('Name', user.full_name)}
        {field('Email', user.email)}
        {field('Role', roleLabel(user.role))}
        {field('Organisation', organisation?.org_name ?? '—')}
      </Card>
    </div>
  );
};
