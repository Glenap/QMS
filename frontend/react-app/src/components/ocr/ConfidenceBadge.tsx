import './ConfidenceBadge.css';

interface ConfidenceBadgeProps {
  score: number | null; // 0.0 to 1.0
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  if (score === null || score === undefined) return null;

  const percentage = Math.round(score * 100);
  let colorClass = 'high';
  let label = 'High Confidence';

  if (score < 0.6) {
    colorClass = 'low';
    label = 'Low Confidence — Please Review';
  } else if (score < 0.85) {
    colorClass = 'medium';
    label = 'Medium Confidence';
  }

  return (
    <span className={`confidence-badge ${colorClass}`} title={label}>
      {percentage}% OCR Match
    </span>
  );
}
