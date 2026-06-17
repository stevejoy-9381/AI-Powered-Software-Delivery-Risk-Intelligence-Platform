/**
 * ErrorState Component
 * Displays an error message with a retry button.
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = 'Something went wrong',
  message = 'An error occurred while loading data. Please try again.',
  onRetry,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-6">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-slate-300 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
