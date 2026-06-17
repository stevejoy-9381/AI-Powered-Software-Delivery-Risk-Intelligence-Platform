/**
 * RiskFactorCard Component
 * Displays individual risk factor with icon, severity, and description.
 */
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { RiskFactor } from '../../types';

const severityConfig = {
  high: { icon: AlertTriangle, bg: 'bg-red-500/10 border-red-500/20', iconColor: 'text-red-400', badge: 'bg-red-500/15 text-red-400' },
  medium: { icon: AlertCircle, bg: 'bg-amber-500/10 border-amber-500/20', iconColor: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400' },
  low: { icon: Info, bg: 'bg-blue-500/10 border-blue-500/20', iconColor: 'text-blue-400', badge: 'bg-blue-500/15 text-blue-400' },
};

interface Props {
  factor: RiskFactor;
}

export default function RiskFactorCard({ factor }: Props) {
  const config = severityConfig[factor.severity] || severityConfig.low;
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border p-4 transition-all hover:scale-[1.01] ${config.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-slate-200">{factor.factor}</h4>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${config.badge}`}>
              {factor.severity}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{factor.description}</p>
          {factor.value !== undefined && (
            <p className="mt-1.5 text-xs font-mono text-slate-500">
              Value: <span className="text-slate-300">{typeof factor.value === 'number' ? factor.value.toFixed(2) : factor.value}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
