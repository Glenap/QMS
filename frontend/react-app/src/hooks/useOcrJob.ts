import { useState, useEffect, useCallback, useRef } from 'react';
import { ocrApi } from '../api/ocr';
import type { OcrJobResponse } from '../types/ocr';

export interface OcrJobHooks {
  createJob: (file: File | number) => Promise<{ job_id: string }>;
  getJob: (jobId: string) => Promise<OcrJobResponse>;
  submitCorrections?: (jobId: string, data: any) => Promise<void>;
}

export function useOcrJob(hooks: OcrJobHooks) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<OcrJobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const startJob = useCallback(async (fileOrId: File | number) => {
    try {
      setError(null);
      setJobId(null);
      setJob(null);
      const res = await hooks.createJob(fileOrId);
      setJobId(res.job_id);
    } catch (err: any) {
      setError(err.message || 'Failed to start OCR job');
    }
  }, [hooks]);

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;
    const poll = async () => {
      try {
        const res = await hooks.getJob(jobId);
        if (!isMounted) return;
        setJob(res);

        if (res.status === 'QUEUED' || res.status === 'PROCESSING') {
          timerRef.current = window.setTimeout(poll, 2000); // poll every 2s
        } else if (res.status === 'FAILED') {
          setError(res.error_message || 'OCR extraction failed.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError('Lost connection to OCR service.');
      }
    };

    poll();

    return () => {
      isMounted = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [jobId, hooks]);

  const clear = useCallback(() => {
    setJobId(null);
    setJob(null);
    setError(null);
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  return { jobId, job, error, startJob, clear };
}
