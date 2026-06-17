/**
 * RiskGauge Component
 * Circular gauge showing 0-100 risk score using Recharts RadialBarChart.
 */
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import type { RiskLevel } from '../../types';

const colorMap: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

interface Props {
  score: number | null;
  size?: number;
  showLabel?: boolean;
  label?: string;
}

export default function RiskGauge({ score, size = 180, showLabel = true, label = 'Risk Score' }: Props) {
  const value = score ?? 0;
  const level = getRiskLevel(value);
  const fill = colorMap[level];

  const data = [{ name: 'risk', value, fill }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="100%"
            barSize={12}
            data={data}
            startAngle={225}
            endAngle={-45}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              background={{ fill: 'rgba(255,255,255,0.05)' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color: fill }}>
            {score !== null ? value : '—'}
          </span>
          {showLabel && (
            <span className="text-[11px] text-slate-500 font-medium mt-0.5">{label}</span>
          )}
        </div>
      </div>
    </div>
  );
}
