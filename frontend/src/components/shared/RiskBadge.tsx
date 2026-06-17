/**
 * RiskBadge Component
 * Displays risk level as a colored pill badge.
 */
import type { RiskLevel } from '../../types';

const config: Record<RiskLevel, { bg: string; text: string; dot: string; label: string }> = {
  low: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Low' },
  medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400', label: 'Medium' },
  high: { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-400', label: 'High' },
  critical: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400', label: 'Critical' },
};

interface Props {
  level: RiskLevel | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export default function RiskBadge({ level, size = 'md', showDot = true }: Props) {
  if (!level) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-500 text-xs font-medium">
        Unscored
      </span>
    );
  }

  const c = config[level];
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${c.bg} ${c.text} ${sizeClasses[size]}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${level === 'critical' ? 'animate-pulse' : ''}`} />}
      {c.label}
    </span>
  );
}
