/**
 * DashboardPage
 * Main landing page with stat cards, sprint risk table, donut chart, and team cards.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  Activity, AlertTriangle, CheckCircle, Heart,
  TrendingUp, TrendingDown, Sparkles, Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI, sprintAPI, teamAPI } from '../utils/api';
import type { DashboardData, Sprint, Team } from '../types';
import RiskBadge from '../components/shared/RiskBadge';
import SkeletonCard from '../components/shared/SkeletonCard';
import SkeletonTable from '../components/shared/SkeletonTable';
import ErrorState from '../components/shared/ErrorState';

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
  unscored: '#475569',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const orgId = user?.organizationId;
      const [dashRes, teamRes] = await Promise.all([
        orgId ? analyticsAPI.getDashboard(orgId) : analyticsAPI.getDashboardSummary(),
        teamAPI.getTeams(orgId),
      ]);

      if (dashRes.data.data) setDashboard(dashRes.data.data as DashboardData);
      if (teamRes.data.data?.teams) {
        setTeams(teamRes.data.data.teams);
        // Fetch sprints for all teams
        const allSprints: Sprint[] = [];
        for (const team of teamRes.data.data.teams.slice(0, 10)) {
          try {
            const spRes = await sprintAPI.getTeamSprints(team._id, { status: 'active', limit: 10 });
            if (spRes.data.data?.sprints) allSprints.push(...spRes.data.data.sprints);
          } catch { /* skip */ }
        }
        setSprints(allSprints);
      }
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAnalyze = async (sprintId: string) => {
    setAnalyzingId(sprintId);
    try {
      const res = await sprintAPI.analyzeSprint(sprintId);
      if (res.data.data) {
        setSprints(prev => prev.map(s =>
          s._id === sprintId
            ? { ...s, riskScore: res.data.data.riskScore ?? s.riskScore, riskLevel: res.data.data.riskLevel ?? s.riskLevel }
            : s
        ));
      }
    } catch { /* toast handled by interceptor */ }
    setAnalyzingId(null);
  };

  // ── Donut chart data ──────────────────────────────────────
  const donutData = dashboard?.riskDistribution
    ? Object.entries(dashboard.riskDistribution)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({ name: key.charAt(0).toUpperCase() + key.slice(1), value, fill: RISK_COLORS[key] }))
    : [];

  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Organization-wide delivery risk overview</p>
      </div>

      {/* ── Stat Cards ─────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard count={4} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Sprints"
            value={dashboard?.totalActiveSprints ?? 0}
            icon={<Activity className="w-5 h-5 text-brand-400" />}
            color="brand"
          />
          <StatCard
            label="At Risk"
            value={(dashboard?.riskDistribution?.high ?? 0) + (dashboard?.riskDistribution?.critical ?? 0)}
            icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
            color="red"
            badge
          />
          <StatCard
            label="On Track"
            value={(dashboard?.riskDistribution?.low ?? 0) + (dashboard?.riskDistribution?.medium ?? 0)}
            icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
            color="green"
          />
          <StatCard
            label="Avg Health Score"
            value={dashboard?.avgHealthScore ?? 0}
            icon={<Heart className="w-5 h-5 text-purple-400" />}
            color="purple"
            suffix="/100"
            trend={dashboard && dashboard.avgHealthScore >= 70 ? 'up' : 'down'}
          />
        </div>
      )}

      {/* ── Sprint Risk Table + Donut Chart ─────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Table */}
        <div className="xl:col-span-2">
          <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Sprint Risk Overview</h2>
              <span className="text-xs text-slate-500">{sprints.length} active sprints</span>
            </div>
            {loading ? (
              <SkeletonTable rows={4} cols={5} />
            ) : sprints.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">No active sprints found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="text-left px-6 py-3">Sprint</th>
                      <th className="text-left px-4 py-3">Team</th>
                      <th className="text-center px-4 py-3">Risk Score</th>
                      <th className="text-center px-4 py-3">Risk Level</th>
                      <th className="text-center px-4 py-3">Days Left</th>
                      <th className="text-center px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[.03]">
                    {sprints
                      .sort((a, b) => (b.riskScore ?? -1) - (a.riskScore ?? -1))
                      .map((sprint) => {
                        const teamName = typeof sprint.teamId === 'object' && sprint.teamId !== null ? (sprint.teamId as Team).name : '';
                        return (
                          <tr
                            key={sprint._id}
                            className="hover:bg-white/[.02] cursor-pointer transition-colors"
                            onClick={() => navigate(`/sprints/${sprint._id}`)}
                          >
                            <td className="px-6 py-3">
                              <p className="text-sm font-medium text-slate-200">{sprint.name}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">{teamName}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-sm font-bold ${
                                (sprint.riskScore ?? 0) >= 75 ? 'text-red-400' :
                                (sprint.riskScore ?? 0) >= 50 ? 'text-orange-400' :
                                (sprint.riskScore ?? 0) >= 25 ? 'text-amber-400' : 'text-emerald-400'
                              }`}>
                                {sprint.riskScore !== null ? sprint.riskScore : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <RiskBadge level={sprint.riskLevel} size="sm" />
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-slate-400">
                              {sprint.daysRemaining}d
                            </td>
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleAnalyze(sprint._id)}
                                disabled={analyzingId === sprint._id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors disabled:opacity-50"
                              >
                                {analyzingId === sprint._id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}
                                Analyze
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Risk Distribution</h2>
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-white/5 animate-pulse" />
            </div>
          ) : donutData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-500">No scored sprints</div>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      cornerRadius={4}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="text-slate-400">{d.name}</span>
                    </div>
                    <span className="font-semibold text-slate-300">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Teams at a Glance ──────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Teams at a Glance</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonCard count={4} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {teams.slice(0, 8).map((team) => {
              const teamSprints = sprints.filter(s => {
                const tid = typeof s.teamId === 'object' && s.teamId !== null ? (s.teamId as Team)._id : s.teamId;
                return tid === team._id;
              });
              const topSprint = teamSprints.sort((a, b) => (b.riskScore ?? -1) - (a.riskScore ?? -1))[0];
              return (
                <div
                  key={team._id}
                  onClick={() => navigate(`/teams/${team._id}`)}
                  className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-5 hover:bg-white/[.03] cursor-pointer transition-all hover:border-white/10 group"
                >
                  <h3 className="text-sm font-semibold text-slate-200 mb-3 group-hover:text-brand-400 transition-colors">{team.name}</h3>
                  {topSprint ? (
                    <>
                      <p className="text-[11px] text-slate-500 mb-1">{topSprint.name}</p>
                      <RiskBadge level={topSprint.riskLevel} size="sm" />
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-600">No active sprint</p>
                  )}
                  <p className="text-[11px] text-slate-600 mt-2">{team.members?.length || 0} members</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat Card Subcomponent ──────────────────────────────────
function StatCard({ label, value, icon, color, badge, suffix, trend }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  badge?: boolean;
  suffix?: string;
  trend?: 'up' | 'down';
}) {
  const colorMap: Record<string, string> = {
    brand: 'from-brand-500/10 to-brand-500/5 border-brand-500/10',
    red: 'from-red-500/10 to-red-500/5 border-red-500/10',
    green: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/10',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/10',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.brand} border rounded-xl p-5 transition-all hover:scale-[1.02]`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <div className="p-1.5 rounded-lg bg-white/5">{icon}</div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-white">{value}</span>
        {suffix && <span className="text-sm text-slate-500 mb-1">{suffix}</span>}
        {badge && value > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold mb-1 animate-pulse">!</span>
        )}
        {trend && (
          <span className={`mb-1 ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </span>
        )}
      </div>
    </div>
  );
}
