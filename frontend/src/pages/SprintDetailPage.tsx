/**
 * SprintDetailPage
 * Most complex page — risk gauge, risk factors, PR table, commit chart, staffing signals.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Calendar, Target, GitCommit, GitPullRequest, Clock, ArrowUpDown,
  Users, CheckCircle, ShieldAlert,
} from 'lucide-react';
import { sprintAPI, githubAPI } from '../utils/api';
import type { Sprint, PullRequest, RiskFactor, AnalyzeResult } from '../types';
import RiskGauge from '../components/shared/RiskGauge';
import RiskBadge from '../components/shared/RiskBadge';
import RiskFactorCard from '../components/shared/RiskFactorCard';
import AnalyzeButton from '../components/shared/AnalyzeButton';
import ConfidenceBadge from '../components/shared/ConfidenceBadge';
import SidePanelPR from '../components/shared/SidePanelPR';
import SkeletonCard from '../components/shared/SkeletonCard';
import ErrorState from '../components/shared/ErrorState';

export default function SprintDetailPage() {
  const { sprintId } = useParams<{ sprintId: string }>();
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [analyzingPR, setAnalyzingPR] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!sprintId) return;
    setLoading(true);
    setError('');
    try {
      const res = await sprintAPI.getSprint(sprintId);
      setSprint(res.data.data.sprint);
      setPrs(res.data.data.pullRequests || []);
    } catch {
      setError('Failed to load sprint data.');
    } finally {
      setLoading(false);
    }
  }, [sprintId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAnalyze = async () => {
    if (!sprintId) return;
    setAnalyzing(true);
    try {
      const res = await sprintAPI.analyzeSprint(sprintId);
      setAnalyzeResult(res.data.data);
      if (res.data.data.riskScore !== null && sprint) {
        setSprint({ ...sprint, riskScore: res.data.data.riskScore, riskLevel: res.data.data.riskLevel });
      }
    } catch { /* handled by interceptor */ }
    setAnalyzing(false);
  };

  const handleAnalyzePR = async (prId: string) => {
    setAnalyzingPR(prId);
    try {
      const res = await githubAPI.analyzePR(prId);
      setPrs(prev => prev.map(p =>
        p._id === prId
          ? { ...p, llmSummary: res.data.data.summary, riskFlags: res.data.data.riskFlags, touchesAuthLogic: res.data.data.touchesAuth }
          : p
      ));
    } catch { /* handled */ }
    setAnalyzingPR(null);
  };

  // ── Build commit-per-day data ──────────────────────────────
  const commitChartData = buildCommitChartData(sprint);
  const avgCommits = commitChartData.length > 0
    ? commitChartData.reduce((s, d) => s + d.commits, 0) / commitChartData.length
    : 0;

  // Parse risk factors from analyze result or sprint
  const riskFactors: RiskFactor[] = analyzeResult?.riskFactors ||
    (sprint?.riskFactors || []).map(f => {
      const [factor, ...rest] = f.split(':');
      return { factor: factor.trim(), description: rest.join(':').trim(), severity: 'medium' as const };
    });

  const staffing = analyzeResult?.staffingSignals;

  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {loading ? (
        <div className="space-y-6">
          <SkeletonCard count={1} className="h-40" />
          <div className="grid grid-cols-2 gap-4"><SkeletonCard count={2} /></div>
        </div>
      ) : sprint ? (
        <>
          {/* ── Header ──────────────────────────────────── */}
          <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-white">{sprint.name}</h1>
                  <RiskBadge level={sprint.riskLevel} size="lg" />
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(sprint.startDate).toLocaleDateString()} — {new Date(sprint.endDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    {sprint.completedPoints}/{sprint.plannedPoints} pts ({sprint.completionPercentage}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {sprint.daysRemaining} days remaining
                  </span>
                </div>
                <div className="mt-4">
                  <AnalyzeButton
                    onClick={handleAnalyze}
                    loading={analyzing}
                    label="Re-Analyze Sprint"
                    loadingLabel="Analyzing sprint..."
                  />
                  {analyzeResult?.confidence != null && (
                    <span className="ml-3">
                      <ConfidenceBadge confidence={analyzeResult.confidence} />
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <RiskGauge score={sprint.riskScore} size={160} />
              </div>
            </div>
          </div>

          {/* ── Risk Factors ────────────────────────────── */}
          {riskFactors.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-200 mb-3">Risk Factors</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {riskFactors.map((f, i) => (
                  <RiskFactorCard key={i} factor={f} />
                ))}
              </div>
            </div>
          )}

          {/* ── PR Table ────────────────────────────────── */}
          <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-brand-400" />
                Pull Requests ({prs.length})
              </h2>
            </div>
            {prs.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">No pull requests in this sprint.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="text-left px-6 py-3">PR</th>
                      <th className="text-left px-4 py-3">Author</th>
                      <th className="text-center px-4 py-3">Files</th>
                      <th className="text-center px-4 py-3">+/−</th>
                      <th className="text-center px-4 py-3">Review Lag</th>
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-center px-4 py-3">AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[.03]">
                    {prs.map((pr) => (
                      <tr
                        key={pr._id}
                        className="hover:bg-white/[.02] cursor-pointer transition-colors"
                        onClick={() => { setSelectedPR(pr); setPanelOpen(true); }}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">#{pr.githubPrNumber}</span>
                            <span className="text-sm text-slate-200 truncate max-w-[200px]">{pr.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{pr.author}</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-400">{pr.filesChanged?.length || 0}</td>
                        <td className="px-4 py-3 text-center text-xs">
                          <span className="text-emerald-400">+{pr.additions}</span>
                          <span className="text-slate-600 mx-1">/</span>
                          <span className="text-red-400">-{pr.deletions}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          <span className={pr.reviewLagHours && pr.reviewLagHours > 24 ? 'text-red-400' : 'text-slate-400'}>
                            {pr.reviewLagHours ? `${pr.reviewLagHours.toFixed(1)}h` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[11px] font-medium capitalize ${
                            pr.status === 'merged' ? 'text-purple-400' :
                            pr.status === 'open' ? 'text-emerald-400' : 'text-slate-500'
                          }`}>
                            {pr.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {pr.llmSummary ? (
                            <span className="text-[10px] text-brand-400">Analyzed</span>
                          ) : (
                            <button
                              onClick={() => handleAnalyzePR(pr._id)}
                              disabled={analyzingPR === pr._id}
                              className="text-[10px] text-slate-500 hover:text-brand-400 transition-colors disabled:opacity-50"
                            >
                              {analyzingPR === pr._id ? '...' : 'Analyze'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Commit Activity Chart ──────────────────── */}
          <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-brand-400" />
              Commit Activity
            </h2>
            {commitChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-slate-500">No commit data available.</div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={commitChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <ReferenceLine y={avgCommits} stroke="#3b82f6" strokeDasharray="6 3" label={{ value: 'Avg', fill: '#3b82f6', fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="commits"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={(props: { cx: number; cy: number; payload: { commits: number } }) => {
                        const { cx, cy, payload } = props;
                        if (payload.commits === 0) {
                          return <circle key={cx} cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#ef4444" strokeWidth={2} />;
                        }
                        return <circle key={cx} cx={cx} cy={cy} r={3} fill="#3b82f6" stroke="#3b82f6" />;
                      }}
                      activeDot={{ r: 5, fill: '#3b82f6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Staffing Signals ────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-400" />
              Staffing Signals
            </h2>
            {staffing && staffing.bottlenecks && staffing.bottlenecks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {staffing.bottlenecks.map((b, i) => (
                  <div key={i} className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <ShieldAlert className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200 capitalize">{b.type.replace(/_/g, ' ')}</h4>
                        <p className="text-xs text-slate-400 mt-1">{b.description}</p>
                        {b.impact_estimate && (
                          <p className="text-xs text-amber-400 mt-1.5 font-medium">{b.impact_estimate}</p>
                        )}
                        {b.historical_evidence && (
                          <p className="text-[11px] text-slate-500 mt-1 italic">{b.historical_evidence}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <p className="text-sm text-emerald-400">Staffing looks healthy — no bottlenecks detected.</p>
              </div>
            )}
          </div>

          {/* ── Sprint Metrics ──────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Tickets Completed" value={sprint.tickets?.filter(t => t.status === 'done').length || 0} total={sprint.tickets?.length || 0} icon={<CheckCircle className="w-4 h-4 text-emerald-400" />} />
            <MetricCard label="PRs Merged" value={prs.filter(p => p.status === 'merged').length} total={prs.length} icon={<GitPullRequest className="w-4 h-4 text-purple-400" />} />
            <MetricCard label="Avg Review Time" value={prs.length > 0 ? `${(prs.reduce((s, p) => s + (p.reviewLagHours || 0), 0) / prs.length).toFixed(1)}h` : '—'} icon={<Clock className="w-4 h-4 text-amber-400" />} />
            <MetricCard label="Scope Change" value={`${sprint.tickets?.filter(t => t.addedMidSprint).length || 0}`} suffix="added" icon={<ArrowUpDown className="w-4 h-4 text-red-400" />} />
          </div>
        </>
      ) : null}

      {/* PR Side Panel */}
      <SidePanelPR pr={selectedPR} isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

// ── Helper: Build commit chart data ─────────────────────────
function buildCommitChartData(sprint: Sprint | null) {
  if (!sprint?.commits?.length) return [];
  const map: Record<string, number> = {};
  for (const c of sprint.commits) {
    const d = new Date(c.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    map[d] = (map[d] || 0) + 1;
  }
  return Object.entries(map).map(([date, commits]) => ({ date, commits }));
}

// ── Metric Card Subcomponent ────────────────────────────────
function MetricCard({ label, value, total, suffix, icon }: {
  label: string;
  value: number | string;
  total?: number;
  suffix?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-surface-700/50 border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">
        {value}
        {total !== undefined && <span className="text-sm text-slate-500 font-normal">/{total}</span>}
        {suffix && <span className="text-sm text-slate-500 font-normal ml-1">{suffix}</span>}
      </p>
    </div>
  );
}
