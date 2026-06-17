/**
 * AnalyzeButton Component
 * Button with loading spinner for triggering ML analysis.
 */
import { Sparkles, Loader2 } from 'lucide-react';

interface Props {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  loadingLabel?: string;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary';
}

export default function AnalyzeButton({
  onClick,
  loading = false,
  label = 'Analyze',
  loadingLabel = 'Analyzing...',
  size = 'md',
  variant = 'primary',
}: Props) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  const variants = {
    primary: 'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/20',
    secondary: 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`${base} ${sizes[size]} ${variants[variant]}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  );
}
