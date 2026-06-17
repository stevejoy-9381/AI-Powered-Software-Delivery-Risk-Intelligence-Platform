/**
 * AnalyticsPage
 * Multi-tab analytics dashboard: Hotspots, Benchmarks, Skill Heatmap, and Risk Trends.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
  Flame, Award, BarChart3, TrendingUp, Loader2, RefreshCw, CheckCircle, AlertTriangle, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { projectAPI, teamAPI, analyticsAPI, githubAPI, sprintAPI } from '../utils/api';
import type { Project, Team, Hotspot, BenchmarkResult, SkillHeatmapEntry, Sprint, RiskTimelineEntry } from '../types';
import ErrorState from '../components/shared/ErrorState';
import SkeletonCard from '../components/shared/SkeletonCard';
import SkeletonTable from '../components/shared/SkeletonTable';

type TabType = 'hotspots' | 'benchmarks' | 'skills' | 'trends';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('hotspots');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dropdown states
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');

  // Tab-specific data states
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [hotspotSummary, setHotspotSummary] = useState<{ total: number; hotspots: number } | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [skills, setSkills] = useState<SkillHeatmapEntry[]>([]);
  const [trends, setTrends] = useState<RiskTimelineEntry[]>([]);

  // Action states
  const [syncing, setSyncing] = useState(false);

  // Load initial dropdowns
  useEffect(() => {
    async function loadDropdowns() {
      try {
        const orgId = user?.organizationId;
        const [projRes, teamRes] = await Promise.all([
          projectAPI.getProjects({ organizationId: orgId }),
          teamAPI.getTeams(orgId)
        ]);

        const projs = projRes.data.data?.projects || [];
        setProjects(projs);
        if (projs.length > 0) {
          setSelectedProjectId(projs[0]._id);
        }

        const tms = teamRes.data.data?.teams || [];
        setTeams(tms);
        if (tms.length > 0) {
          setSelectedTeamId(tms[0]._id);
        }
      } catch (err) {
        console.error('Failed to load dropdown filters:', err);
        setError('Failed to load filter configurations.');
      }
    }
    loadDropdowns();
  }, [user]);

  // Load sprints for the selected team to use in Trends tab
  useEffect(() => {
    if (!selectedTeamId) return;
    async function loadSprints() {
      try {
        const res = await sprintAPI.getTeamSprints(selectedTeamId, { limit: 20 });
        const sps = res.data.data?.sprints || [];
        setSprints(sps);
        if (sps.length > 0) {
          setSelectedSprintId(sps[0]._id);
        } else {
          setSelectedSprintId('');
        }
      } catch (err) {
        console.error('Failed to load team sprints:', err);
      }
    }
    loadSprints();
  }, [selectedTeamId]);

  // Load Hotspots data
  const loadHotspots = useCallback(async (projId: string) => {
    if (!projId) return;
    setLoading(true);
    setError('');
    try {
      const res = await githubAPI.analyzeHotspots(projId);
      setHotspots(res.data.data?.hotspots || []);
      setHotspotSummary({
        total: res.data.data?.totalFilesAnalyzed || 0,
        hotspots: res.data.data?.hotspotCount || 0,
      });
    } catch {
      setError('Failed to load codebase hotspots. Make sure repository integration is active.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Benchmarks data
  const loadBenchmark = useCallback(async (teamId: string) => {
    if (!teamId) return;
    setLoading(true);
    setError('');
    try {
      const res = await analyticsAPI.getTeamBenchmark(teamId);
      setBenchmark(res.data.data);
    } catch {
      setError('Failed to calculate team benchmark.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Skills Heatmap
  const loadSkills = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const res = await analyticsAPI.getSkillHeatmap(orgId);
      setSkills(res.data.data?.heatmap || []);
    } catch {
      setError('Failed to fetch skill risk heatmap.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load Risk Trends (Risk Timeline)
  const loadTrends = useCallback(async (sprintId: string) => {
    if (!sprintId) {
      setTrends([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await analyticsAPI.getRiskTimeline(sprintId);
      setTrends(res.data.data?.timeline || []);
    } catch {
      setError('Failed to load sprint risk timeline.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Orchestrate loading based on active tab
  useEffect(() => {
    if (activeTab === 'hotspots' && selectedProjectId) {
      loadHotspots(selectedProjectId);
    } else if (activeTab === 'benchmarks' && selectedTeamId) {
      loadBenchmark(selectedTeamId);
    } else if (activeTab === 'skills') {
      loadSkills();
    } else if (activeTab === 'trends' && selectedSprintId) {
      loadTrends(selectedSprintId);
    } else {
      setLoading(false);
    }
  }, [activeTab, selectedProjectId, selectedTeamId, selectedSprintId, loadHotspots, loadBenchmark, loadSkills, loadTrends]);

  const handleSyncProject = async () => {
    if (!selectedProjectId) return;
    setSyncing(true);
    try {
      await githubAPI.syncProject(selectedProjectId);
      // reload hotspots after sync
      await loadHotspots(selectedProjectId);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="space-y-6">
          <SkeletonCard count={1} className="h-28" />
          <SkeletonTable rows={5} cols={4} />
        </div>
      );
    }

    if (error) {
      return <ErrorState message={error} onRetry={() => {
        if (activeTab === 'hotspots') loadHotspots(selectedProjectId);
        else if (activeTab === 'benchmarks') loadBenchmark(selectedTeamId);
        else if (activeTab === 'skills') loadSkills();
        else if (activeTab === 'trends') loadTrends(selectedSprintId);
      }} />;
    }

    switch (activeTab) {
      case 'hotspots':
        return (
          <div className="space-y-6">
            {/* Project Selector & Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Project:</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="px-3 py-1.5 bg-surface-800 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={handleSyncProject}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition-colors shadow-lg"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {syncing ? 'Syncing Repo...' : 'Sync GitHub Repo'}
                </button>
              </div>
            </div>

            {/* Hotspots Summary Card */}
            {hotspotSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-5 flex items-center gap-4">
                  <div className="p-3 bg-brand-500/10 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-xs text-slate-400 font-medium">Total Files Analyzed</h3>
                    <p className="text-2xl font-bold text-white mt-0.5">{hotspotSummary.total}</p>
                  </div>
                </div>
                <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-5 flex items-center gap-4">
                  <div className="p-3 bg-red-500/10 rounded-xl">
                    <Flame className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-xs text-slate-400 font-medium">Flagged Code Hotspots</h3>
                    <p className="text-2xl font-bold text-red-400 mt-0.5">{hotspotSummary.hotspots}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Hotspots Table */}
            <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5">
                <h3 className="text-sm font-semibold text-slate-200">Flagged Churn & Risk Hotspots</h3>
                <p className="text-xs text-slate-500 mt-0.5">Files with high modification frequency and low test coverage</p>
              </div>
              {hotspots.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">No hotspots flagged. Try triggering a sync above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="text-left px-6 py-3">File Path</th>
                        <th className="text-center px-4 py-3">Risk Score</th>
                        <th className="text-center px-4 py-3">Churn Count</th>
                        <th className="text-center px-4 py-3">Complexity</th>
                        <th className="text-center px-4 py-3">Test Coverage</th>
                        <th className="text-center px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[.03]">
                      {hotspots.map((h, i) => (
                        <tr key={i} className="hover:bg-white/[.01] transition-colors">
                          <td className="px-6 py-3 font-mono text-xs text-slate-300 max-w-xs sm:max-w-md truncate" title={h.file_path}>
                            {h.file_path}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-bold ${
                              h.hotspot_score >= 80 ? 'text-red-400' :
                              h.hotspot_score >= 55 ? 'text-orange-400' : 'text-amber-400'
                            }`}>
                              {Math.round(h.hotspot_score)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-400">{h.churn_count || 0}</td>
                          <td className="px-4 py-3 text-center text-xs">
                            {h.complexity_score !== undefined ? (
                              <span className={h.complexity_score >= 70 ? 'text-red-400' : h.complexity_score >= 45 ? 'text-orange-400' : 'text-slate-400'}>
                                {Math.round(h.complexity_score)}/100
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-xs">
                            {h.test_coverage_percent !== undefined ? (
                              <span className={h.test_coverage_percent < 50 ? 'text-red-400' : 'text-slate-400'}>
                                {h.test_coverage_percent}%
                              </span>
                            ) : (
                              <span className="text-slate-600">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {h.is_hotspot ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                Hotspot
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-500/20 text-slate-400">
                                Monitored
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      case 'benchmarks':
        if (!benchmark) return null;
        // Transform breakdown for Radar chart
        const radarData = benchmark.breakdown.map((b) => ({
          subject: (b.category || b.metric || '').replace(/_/g, ' ').toUpperCase(),
          A: b.score,
          fullMark: 100,
        }));

        return (
          <div className="space-y-6">
            {/* Filter Section */}
            <div className="flex items-center gap-3 bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-4">
              <span className="text-xs text-slate-400 font-medium">Team:</span>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="px-3 py-1.5 bg-surface-800 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              >
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Benchmark Score Header */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-gradient-to-br from-brand-500/10 to-brand-500/5 border border-brand-500/10 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Delivery Health Score</h3>
                  <div className="flex items-baseline gap-2 mt-4">
                    <span className="text-6xl font-extrabold text-white">{benchmark.healthScore}</span>
                    <span className="text-xl text-slate-500">/100</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-4">
                    Team is ranked in the <span className="text-brand-400 font-semibold">{benchmark.percentile}%</span> percentile organization-wide.
                  </p>
                </div>
                <div className="mt-6 border-t border-white/5 pt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Health Rating</span>
                  <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">{benchmark.healthGrade}</span>
                </div>
              </div>

              {/* Radar Chart for breakdown */}
              <div className="lg:col-span-2 bg-surface-700/50 border border-white/5 rounded-xl p-6 flex flex-col">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Metric Score Breakdown</h3>
                <div className="h-60 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.05)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569' }} />
                      <Radar name="Score" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recommendations & History */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recommendations */}
              <div className="lg:col-span-2 bg-surface-700/50 border border-white/5 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 text-brand-400" />
                  AI Optimization Plan
                </h3>
                {benchmark.recommendations?.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No optimizations suggested at this time. Keep it up!</div>
                ) : (
                  <div className="space-y-3">
                    {benchmark.recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-3 p-3.5 rounded-lg bg-white/5 border border-white/5">
                        <CheckCircle className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-slate-300 leading-relaxed">{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* History Trend */}
              <div className="bg-surface-700/50 border border-white/5 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-400" />
                  Historical Health Trend
                </h3>
                {benchmark.history?.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-xs text-slate-500 italic">No historical data recorded yet.</div>
                ) : (
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={benchmark.history.slice().reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }} />
                        <Line type="monotone" dataKey="delivery_health_score" name="Health Score" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-surface-700/50 border border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-200">Skill Risk Heatmap</h3>
              <p className="text-xs text-slate-500 mt-1">Cross-referencing technology stack categories with historical delays and average sprint risk metrics.</p>
            </div>

            {/* Heatmap Bar Chart */}
            <div className="bg-surface-700/50 border border-white/5 rounded-xl p-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Average Risk Score by Technology Stack</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={skills}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="techStack" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }} />
                    <Bar dataKey="avgRiskScore" name="Avg Risk Score" radius={[4, 4, 0, 0]}>
                      {skills.map((entry, index) => {
                        const score = entry.avgRiskScore;
                        const fill = score >= 75 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 25 ? '#f59e0b' : '#10b981';
                        return <Bar key={`cell-${index}`} fill={fill} dataKey="avgRiskScore" />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* List Table */}
            <div className="bg-surface-700/50 border border-white/5 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="text-left px-6 py-3">Technology Stack</th>
                      <th className="text-center px-4 py-3">Sprints Conducted</th>
                      <th className="text-center px-4 py-3">Avg Risk Score</th>
                      <th className="text-center px-4 py-3">Delay Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[.03]">
                    {skills.map((sk, idx) => (
                      <tr key={idx} className="hover:bg-white/[.01] transition-colors">
                        <td className="px-6 py-3 text-sm font-semibold text-slate-300 capitalize">{sk.techStack}</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-400">{sk.sprintCount}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-bold ${
                            sk.avgRiskScore >= 75 ? 'text-red-400' :
                            sk.avgRiskScore >= 50 ? 'text-orange-400' :
                            sk.avgRiskScore >= 25 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {sk.avgRiskScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold ${sk.delayRate > 0.4 ? 'text-red-400' : sk.delayRate > 0.2 ? 'text-orange-400' : 'text-slate-400'}`}>
                            {(sk.delayRate * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'trends':
        return (
          <div className="space-y-6">
            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Team:</span>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="px-3 py-1.5 bg-surface-800 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    {teams.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Sprint:</span>
                  <select
                    value={selectedSprintId}
                    onChange={(e) => setSelectedSprintId(e.target.value)}
                    disabled={sprints.length === 0}
                    className="px-3 py-1.5 bg-surface-800 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50"
                  >
                    {sprints.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Prediction Trends Line Chart */}
            <div className="bg-surface-700/50 border border-white/5 rounded-xl p-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Sprint Risk Fluctuation (Predictions Log)</h3>
              {trends.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-sm text-slate-500 italic">
                  <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
                  No risk prediction history recorded for this sprint yet.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends.map((t, idx) => ({ ...t, key: `Prediction #${idx + 1}` }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="key" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <Line type="monotone" dataKey="riskScore" name="Risk Score" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="confidence" name="ML Confidence" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* List Table of log entries */}
            {trends.length > 0 && (
              <div className="bg-surface-700/50 border border-white/5 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-slate-200">Historical Model Output Log</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="text-left px-6 py-3">Timestamp</th>
                        <th className="text-center px-4 py-3">Risk Score</th>
                        <th className="text-center px-4 py-3">Predicted Delay</th>
                        <th className="text-center px-4 py-3">Confidence</th>
                        <th className="text-left px-6 py-3">Identified Factors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[.03]">
                      {trends.slice().reverse().map((t, idx) => (
                        <tr key={idx} className="hover:bg-white/[.01] transition-colors">
                          <td className="px-6 py-3 text-xs text-slate-400 whitespace-nowrap">
                            {new Date(t.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-bold text-slate-200">{t.riskScore}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {t.predictedDelay ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-semibold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                <AlertTriangle className="w-3 h-3" /> Yes
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-400">{(t.confidence * 100).toFixed(0)}%</td>
                          <td className="px-6 py-3 text-xs text-slate-500 leading-normal max-w-sm truncate" 
                              title={
                                Array.isArray(t.riskFactors)
                                  ? t.riskFactors.map((f: any) => typeof f === 'object' ? (f.description || f.factor || '') : f).filter(Boolean).join(', ')
                                  : typeof t.riskFactors === 'string'
                                  ? t.riskFactors
                                  : 'None'
                              }>
                            {Array.isArray(t.riskFactors)
                              ? t.riskFactors.map((f: any) => typeof f === 'object' ? (f.description || f.factor || '') : f).filter(Boolean).join(', ') || 'None'
                              : typeof t.riskFactors === 'string'
                              ? t.riskFactors || 'None'
                              : 'None'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Deep codebase, team productivity, and predictive health insights</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 space-x-4">
        <TabButton active={activeTab === 'hotspots'} onClick={() => setActiveTab('hotspots')} label="Hotspots" icon={<Flame className="w-4 h-4" />} />
        <TabButton active={activeTab === 'benchmarks'} onClick={() => setActiveTab('benchmarks')} label="Team Benchmarks" icon={<Award className="w-4 h-4" />} />
        <TabButton active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} label="Skill Heatmap" icon={<BarChart3 className="w-4 h-4" />} />
        <TabButton active={activeTab === 'trends'} onClick={() => setActiveTab('trends')} label="Sprint Trends" icon={<TrendingUp className="w-4 h-4" />} />
      </div>

      {/* Content */}
      <div className="mt-6">
        {renderTabContent()}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-all ${
        active
          ? 'border-brand-500 text-brand-400'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
