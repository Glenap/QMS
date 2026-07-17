import { useState } from 'react';
import type { OcrJobResponse } from '../../types/ocr';
import { ConfidenceBadge } from './ConfidenceBadge';
import { ocrApi } from '../../api/ocr';
import './OcrReviewForm.css';

interface OcrReviewFormProps {
  job: OcrJobResponse;
  onCancel: () => void;
  onConfirm: (finalData: any) => void;
  submitCorrections?: (jobId: string, data: any) => Promise<void>;
}

export function OcrReviewForm({ job, onCancel, onConfirm, submitCorrections }: OcrReviewFormProps) {
  const [domainData, setDomainData] = useState<Record<string, any>>(
    job.result_json?.domain_data || {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fields = job.result_json?.fields || {};

  const handleFieldChange = (key: string, value: string) => {
    setDomainData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      
      // Submit corrections in the background (fire and forget for UX, or await it)
      if (job.doc_type) {
        const payload = {
          doc_type: job.doc_type,
          original_fields: fields,
          final_fields: domainData,
        };
        
        if (submitCorrections) {
          await submitCorrections(job.job_id, payload);
        } else {
          // Fallback to default internal API if no specific hook provided
          await ocrApi.submitCorrections(job.project_id, job.job_id, payload);
        }
      }
      
      onConfirm(domainData);
    } catch (err) {
      console.error('Failed to submit corrections', err);
      // We still want to let them proceed even if analytics failed
      onConfirm(domainData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ocr-review-form">
      <div className="ocr-review-header">
        <div className="ocr-review-title-row">
          <h3>Review Extracted Data</h3>
          <ConfidenceBadge score={job.overall_confidence} />
        </div>
        <p className="ocr-review-subtitle">
          Document Type: <strong>{job.doc_type || 'Unknown'}</strong> 
          {' • '}{job.page_count} pages
        </p>
      </div>

      <div className="ocr-review-fields">
        {Object.entries(domainData).map(([key, value]) => {
          const fieldMeta = fields[key];
          const isLowConfidence = fieldMeta?.confidence !== undefined && fieldMeta.confidence < 0.6;
          
          return (
            <div key={key} className={`ocr-field-group ${isLowConfidence ? 'low-confidence-group' : ''}`}>
              <div className="ocr-field-label-row">
                <label htmlFor={`ocr-${key}`}>{formatKey(key)}</label>
                {fieldMeta && (
                  <span className="ocr-field-conf" title={`Method: ${fieldMeta.method}`}>
                    {Math.round(fieldMeta.confidence * 100)}%
                  </span>
                )}
              </div>
              <input
                id={`ocr-${key}`}
                type="text"
                className="ocr-field-input"
                value={value ?? ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
              />
            </div>
          );
        })}
      </div>

      <div className="ocr-review-actions">
        <button className="ocr-btn-secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button className="ocr-btn-primary" onClick={handleConfirm} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Confirm & Autofill'}
        </button>
      </div>
    </div>
  );
}

function formatKey(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
