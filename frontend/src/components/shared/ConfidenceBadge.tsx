/**
 * ConfidenceBadge Component
 * Shows ML confidence as a percentage with tooltip.
 */

interface Props {
  confidence: number;
}

export default function ConfidenceBadge({ confidence }: Props) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}
      title={`ML model confidence: ${pct}%. Higher values indicate the model is more certain about this prediction.`}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      {pct}% conf.
    </span>
  );
}
