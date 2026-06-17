/**
 * TeamPage
 * Renders the team list, team member management, and staffing health insights.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, Calendar, ArrowLeft, Loader2, Sparkles, CheckCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { teamAPI, sprintAPI, analyticsAPI } from '../utils/api';
import type { Team, Sprint, BenchmarkResult } from '../types';
import ErrorState from '../components/shared/ErrorState';
import SkeletonCard from '../components/shared/SkeletonCard';
import SkeletonTable from '../components/shared/SkeletonTable';
import toast from 'react-hot-toast';

export default function TeamPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected Team Details
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'sprints' | 'performance'>('members');
  const [teamSprints, setTeamSprints] = useState<Sprint[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Modals & Forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newMember, setNewMember] = useState({ userId: '', role: 'mid' as const });
  const [submitting, setSubmitting] = useState(false);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await teamAPI.getTeams(user?.organizationId);
      setTeams(res.data.data?.teams || []);
    } catch {
      setError('Failed to load teams.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const selectTeam = async (team: Team) => {
    setSelectedTeam(team);
    setDetailsLoading(true);
    try {
      const [sprintsRes, benchmarkRes] = await Promise.all([
        sprintAPI.getTeamSprints(team._id, { limit: 15 }),
        analyticsAPI.getTeamBenchmark(team._id).catch(() => null), // fail silently if benchmark is not ready
      ]);
      setTeamSprints(sprintsRes.data.data?.sprints || []);
      if (benchmarkRes) {
        setBenchmark(benchmarkRes.data.data);
      } else {
        setBenchmark(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not fetch all team details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName) return;
    setSubmitting(true);
    try {
      const res = await teamAPI.createTeam({
        name: newTeamName,
        organizationId: user?.organizationId,
        isActive: true,
      });
      if (res.data.success) {
        toast.success('Team created successfully!');
        setShowCreateModal(false);
        setNewTeamName('');
        loadTeams();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to create team');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !newMember.userId) return;
    setSubmitting(true);
    try {
      // Direct call to the backend members endpoint
      const res = await teamAPI.updateTeam(selectedTeam._id, {
        members: [...selectedTeam.members, { userId: newMember.userId, role: newMember.role }]
      });
      if (res.data.success) {
        toast.success('Team member added successfully!');
        setShowAddMemberModal(false);
        setNewMember({ userId: '', role: 'mid' });
        // Refresh team details
        selectTeam(res.data.data.team);
        loadTeams();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to add member to team');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={loadTeams} />;

  // ── Render Detailed View ─────────────────────────────────────
  if (selectedTeam) {
    const managerName = typeof selectedTeam.managerId === 'object' && selectedTeam.managerId !== null
      ? (selectedTeam.managerId as any).name : 'No Manager';

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Back Button & Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setSelectedTeam(null); setBenchmark(null); setTeamSprints([]); }}
            className="p-2 rounded-lg bg-surface-700/50 hover:bg-surface-700 border border-white/5 text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{selectedTeam.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manager: {managerName}</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/5 space-x-4">
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'members' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Members ({selectedTeam.members?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('sprints')}
            className={`pb-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'sprints' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Sprints
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`pb-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'performance' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Performance Benchmarks
          </button>
        </div>

        {/* Tab Contents */}
        <div className="mt-6">
          {detailsLoading ? (
            <div className="space-y-4">
              <SkeletonCard count={1} className="h-24" />
              <SkeletonTable rows={4} cols={3} />
            </div>
          ) : activeTab === 'members' ? (
            <div className="space-y-6">
              {/* Member Control Header */}
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-200">Active Team Rosters</h3>
                {user && (user.role === 'admin' || user.role === 'manager') && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="flex items-center gap-1.5 btn-primary text-xs"
                  >
                    <Plus className="w-4 h-4" /> Add Member
                  </button>
                )}
              </div>

              {/* Members List */}
              <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="text-left px-6 py-3">Member</th>
                        <th className="text-left px-4 py-3">Role</th>
                        <th className="text-left px-4 py-3">GitHub Username</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[.03]">
                      {selectedTeam.members?.map((m: any, i) => {
                        const name = typeof m.userId === 'object' && m.userId !== null ? m.userId.name : 'Unknown User';
                        const email = typeof m.userId === 'object' && m.userId !== null ? m.userId.email : '';
                        const gh = typeof m.userId === 'object' && m.userId !== null ? m.userId.githubUsername : '—';
                        return (
                          <tr key={i} className="hover:bg-white/[.01] transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400">
                                  {name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-200">{name}</p>
                                  {email && <p className="text-[11px] text-slate-500 mt-0.5">{email}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs font-medium text-slate-300 capitalize">{m.role}</td>
                            <td className="px-4 py-4 font-mono text-xs text-slate-400">{gh || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'sprints' ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">Sprints History</h3>
              {teamSprints.length === 0 ? (
                <div className="bg-surface-700/50 border border-white/5 rounded-xl p-8 text-center text-xs text-slate-500">
                  No sprints found for this team.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamSprints.map((s) => (
                    <div
                      key={s._id}
                      onClick={() => navigate(`/sprints/${s._id}`)}
                      className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-5 hover:bg-white/[.02] cursor-pointer transition-all hover:border-white/10 group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-200 group-hover:text-brand-400 transition-colors">{s.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize border ${
                            s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            s.status === 'completed' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                            'bg-slate-500/20 text-slate-400 border-slate-500/30'
                          }`}>
                            {s.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(s.startDate).toLocaleDateString()} — {new Date(s.endDate).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="text-xs text-slate-400">{s.completedPoints}/{s.plannedPoints} pts</span>
                        {s.riskScore !== null && (
                          <span className={`text-xs font-bold ${
                            s.riskScore >= 75 ? 'text-red-400' : s.riskScore >= 50 ? 'text-orange-400' : 'text-emerald-400'
                          }`}>
                            Risk: {s.riskScore}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {benchmark ? (
                <>
                  {/* Health summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-surface-700/50 border border-white/5 rounded-xl p-6">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase">Delivery Health Grade</h4>
                      <p className="text-5xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mt-4">
                        {benchmark.healthGrade}
                      </p>
                    </div>

                    <div className="bg-surface-700/50 border border-white/5 rounded-xl p-6">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase">Health Score</h4>
                      <p className="text-5xl font-extrabold text-white mt-4">{benchmark.healthScore}</p>
                    </div>

                    <div className="bg-surface-700/50 border border-white/5 rounded-xl p-6">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase">Percentile Rank</h4>
                      <p className="text-5xl font-extrabold text-brand-400 mt-4">{benchmark.percentile}%</p>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className="bg-surface-700/50 border border-white/5 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-slate-200 mb-4">
                      Health Category Breakdown
                    </h3>
                    <div className="space-y-4">
                      {benchmark.breakdown?.map((cat) => {
                        const progressColor =
                          cat.score >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                          cat.score >= 60 ? 'bg-gradient-to-r from-amber-500 to-orange-400' :
                          'bg-gradient-to-r from-red-500 to-rose-400';

                        return (
                          <div key={cat.category} className="space-y-1.5 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-slate-300">
                                {cat.category} <span className="text-slate-500 font-normal">({(cat.weight * 100).toFixed(0)}% weight)</span>
                              </span>
                              <span className="font-mono font-bold text-slate-200">{cat.score.toFixed(1)} / 100</span>
                            </div>
                            
                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${progressColor} transition-all duration-500`}
                                style={{ width: `${cat.score}%` }}
                              />
                            </div>
                            
                            <div className="text-[11px] text-slate-400 flex justify-between">
                              <span>{cat.details}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-surface-700/50 border border-white/5 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand-400" />
                      Team Recommendations
                    </h3>
                    {benchmark.recommendations?.length === 0 ? (
                      <div className="text-xs text-slate-500 italic">No recommendations yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {benchmark.recommendations.map((rec, i) => (
                          <div key={i} className="flex gap-3 p-3 bg-white/5 border border-white/5 rounded-lg text-xs text-slate-300">
                            <CheckCircle className="w-4 h-4 text-brand-400 flex-shrink-0" />
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-surface-700/50 border border-white/5 rounded-xl p-12 text-center text-xs text-slate-500">
                  Benchmark calculations are not yet generated. Complete a few sprints to unlock this tab.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render List View ────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Teams</h1>
          <p className="text-sm text-slate-500 mt-1">Manage team structures, developers, and staffing velocity signals</p>
        </div>

        {/* Create Button (Admin/Manager only) */}
        {user && (user.role === 'admin' || user.role === 'manager') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 btn-primary text-xs"
          >
            <Plus className="w-4 h-4" /> Create Team
          </button>
        )}
      </div>

      {/* Grid of Teams */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard count={3} />
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-surface-700/50 border border-white/5 rounded-xl p-12 text-center text-sm text-slate-500">
          No teams configured. Click &quot;Create Team&quot; to define a new developer group.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => {
            const managerName = typeof team.managerId === 'object' && team.managerId !== null
              ? (team.managerId as any).name : 'No Manager';

            return (
              <div
                key={team._id}
                onClick={() => selectTeam(team)}
                className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-5 hover:bg-white/[.02] cursor-pointer transition-all hover:border-white/10 group flex flex-col justify-between h-40"
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 group-hover:text-brand-400 transition-colors truncate">{team.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">Manager: {managerName}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {team.members?.length || 0} members
                  </span>
                  <span className="text-brand-400">View Roster →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface-800 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-surface-700/30">
              <h3 className="font-semibold text-white">Create New Team</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-xs">Close</button>
            </div>
            <form onSubmit={handleCreateTeam} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="E.g. Core Platform Team"
                  required
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-all shadow-lg disabled:opacity-50 mt-2 text-sm"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Team'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Member Modal ────────────────────────────────── */}
      {showAddMemberModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface-800 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-surface-700/30">
              <h3 className="font-semibold text-white">Add Team Member</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-slate-400 hover:text-white text-xs">Close</button>
            </div>
            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">User ID / Email</label>
                <input
                  type="text"
                  value={newMember.userId}
                  onChange={(e) => setNewMember({ ...newMember, userId: e.target.value })}
                  placeholder="Enter user document ID or Email"
                  required
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Developer Role</label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value as any })}
                  className="w-full px-3 py-2 bg-surface-700 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  <option value="lead">Lead Developer</option>
                  <option value="senior">Senior Developer</option>
                  <option value="mid">Mid-level Developer</option>
                  <option value="junior">Junior Developer</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-all shadow-lg disabled:opacity-50 mt-2 text-sm"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add Member'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
