import type { OcrJobResponse } from '../../types/ocr';

interface OcrJobStatusProps {
  job: OcrJobResponse | null;
  error: string | null;
  onCancel: () => void;
}

export function OcrJobStatus({ job, error, onCancel }: OcrJobStatusProps) {
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md my-4 border border-red-200">
        <h4 className="font-semibold mb-1">OCR Processing Failed</h4>
        <p className="text-sm">{error}</p>
        <button 
          onClick={onCancel}
          className="mt-3 text-sm font-medium hover:underline text-red-800"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="p-6 bg-white rounded-md shadow-sm border border-slate-200 my-4 flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
      <h4 className="font-semibold text-slate-800 mb-1">
        {job.status === 'QUEUED' ? 'Queued for processing...' : 'Analyzing document...'}
      </h4>
      <p className="text-sm text-slate-500 mb-4 text-center">
        Our AI is extracting tables, fields, and text.<br/>
        This usually takes 5-15 seconds.
      </p>
      
      {job.status === 'PROCESSING' && job.doc_type && (
        <div className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
          Detected: {job.doc_type}
        </div>
      )}
    </div>
  );
}
