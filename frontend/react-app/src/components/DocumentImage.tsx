// Renders a stored document (image) inline. Document bytes need the bearer token,
// so we can't use the download URL as a plain <img src> — we fetch the blob, hand
// <img> an object URL, and revoke it on unmount.

import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { documentsApi } from '../api/documents';

interface Props {
  pid: number;
  documentId: number;
  alt?: string;
  className?: string;
}

export const DocumentImage: React.FC<Props> = ({ pid, documentId, alt, className }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let created: string | null = null;
    setUrl(null);
    setFailed(false);
    documentsApi
      .objectUrl(pid, documentId)
      .then((u) => {
        if (active) { created = u; setUrl(u); } else { URL.revokeObjectURL(u); }
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (created) URL.revokeObjectURL(created); };
  }, [pid, documentId]);

  if (failed || !url) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ImageIcon size={28} className="text-muted" />
      </div>
    );
  }
  return <img src={url} alt={alt ?? ''} className={className} style={{ objectFit: 'cover' }} />;
};
