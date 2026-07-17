import { useState, useRef, useEffect } from 'react';
import { useOcrJob, type OcrJobHooks } from '../../hooks/useOcrJob';
import { OcrJobStatus } from './OcrJobStatus';
import { OcrReviewForm } from './OcrReviewForm';
import './OcrUploadZone.css';

interface OcrUploadZoneProps {
  hooks: OcrJobHooks;
  onSuccess: (domainData: any, file: File) => void;
}

export function OcrUploadZone({ hooks, onSuccess }: OcrUploadZoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { jobId, job, error, startJob, clear } = useOcrJob(hooks);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setActiveFile(file);
      // Trigger OCR extraction directly with the file (or let the hook handle document upload)
      await startJob(file);
    } catch (err) {
      console.error(err);
      alert('Failed to upload document.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReviewComplete = (finalData: any) => {
    if (activeFile) {
      onSuccess(finalData, activeFile);
    }
    setActiveFile(null);
    clear();
  };

  useEffect(() => {
    if (job?.status === 'COMPLETED' && job.result_json) {
      handleReviewComplete(job.result_json.domain_data || {});
    }
  }, [job]);

  if (job) {
    if (job.status === 'COMPLETED') {
      return null; // Will be handled by useEffect
    }
    
    return (
      <OcrJobStatus job={job} error={error} onCancel={clear} />
    );
  }

  return (
    <div className="ocr-upload-zone">
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="ocr-file-input"
        onChange={handleFileChange}
        ref={fileInputRef}
        id="ocr-upload-input"
      />
      <label htmlFor="ocr-upload-input" className="ocr-upload-label">
        <div className="ocr-upload-icon">📄</div>
        <div className="ocr-upload-text">
          {isUploading ? 'Uploading...' : 'Upload PDF or Image to Autofill'}
        </div>
        <div className="ocr-upload-hint">Powered by Intelligent Document Processing</div>
      </label>
    </div>
  );
}
