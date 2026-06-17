/**
 * ProjectPage
 * Renders the project list, release readiness metrics, and provides project creation.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, ArrowLeft, RefreshCw, Loader2, AlertCircle, CheckCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { projectAPI, teamAPI, analyticsAPI, githubAPI } from '../utils/api';
import type { Project, Team, ReleaseReadiness } from '../types';
import ErrorState from '../components/shared/ErrorState';
import SkeletonCard from '../components/shared/SkeletonCard';
import toast from 'react-hot-toast';

export default function ProjectPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selection states
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [readiness, setReadiness] = useState<ReleaseReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  // Modal / Creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    teamId: '',
    githubRepo: '',
    techStack: '',
    criticality: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const orgId = user?.organizationId;
      const [projRes, teamRes] = await Promise.all([
        projectAPI.getProjects({ organizationId: orgId }),
        teamAPI.getTeams(orgId)
      ]);
      setProjects(projRes.data.data?.projects || []);
      setTeams(teamRes.data.data?.teams || []);
    } catch {
      setError('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const selectProject = async (project: Project) => {
    setSelectedProject(project);
    setReadinessLoading(true);
    try {
      const res = await analyticsAPI.getReleaseReadiness(project._id);
      setReadiness(res.data.data);
    } catch {
      setReadiness(null);
    } finally {
      setReadinessLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.teamId) {
      toast.error('Please enter a project name and select a team.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: newProject.name,
        description: newProject.description,
        teamId: newProject.teamId,
        organizationId: user?.organizationId,
        githubRepo: newProject.githubRepo,
        techStack: newProject.techStack.split(',').map(s => s.trim()).filter(Boolean),
        criticality: newProject.criticality as 'low' | 'medium' | 'high' | 'critical',
        status: 'active' as const,
      };

      const res = await projectAPI.createProject(payload);
      if (res.data.success) {
        toast.success('Project created successfully!');
        setShowCreateModal(false);
        setNewProject({
          name: '',
          description: '',
          teamId: '',
          githubRepo: '',
          techStack: '',
          criticality: 'medium',
        });
        loadProjects();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncRepo = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncingId(projectId);
    try {
      const res = await githubAPI.syncProject(projectId);
      if (res.data.success) {
        toast.success(`Synced! Added ${res.data.data.commitsAdded} commits and ${res.data.data.prsAdded} PRs.`);
        if (selectedProject?._id === projectId) {
          // reload readiness
          const readinessRes = await analyticsAPI.getReleaseReadiness(projectId);
          setReadiness(readinessRes.data.data);
        }
      }
    } catch (err: any) {
      toast.error('Sync failed. Check your GitHub configurations.');
    } finally {
      setSyncingId(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={loadProjects} />;

  // ── Render Details View ─────────────────────────────────────
  if (selectedProject) {
    const isReadyScore = readiness?.readinessScore || 0;
    const readinessColor = isReadyScore >= 80 ? 'text-emerald-400' : isReadyScore >= 50 ? 'text-amber-400' : 'text-red-400';
    const teamName = typeof selectedProject.teamId === 'object' && selectedProject.teamId !== null ? (selectedProject.teamId as Team).name : '';

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Back Button & Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setSelectedProject(null); setReadiness(null); }}
            className="p-2 rounded-lg bg-surface-700/50 hover:bg-surface-700 border border-white/5 text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{selectedProject.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">Team: {teamName}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Release Readiness Card */}
          <div className="lg:col-span-1 bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-200 mb-4">Release Readiness</h2>

            {readinessLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
              </div>
            ) : readiness ? (
              <div className="space-y-6 text-center">
                <div className="inline-flex flex-col items-center justify-center p-8 bg-white/5 rounded-full border border-white/5">
                  <span className={`text-5xl font-extrabold ${readinessColor}`}>{readiness.readinessScore}%</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Readiness Score</span>
                </div>

                <div className="text-left bg-white/5 border border-white/5 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-slate-400 mb-1">AI Recommendation</h4>
                  <p className="text-xs text-slate-200 leading-relaxed">{readiness.recommendation}</p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">No release readiness analysis available. Ensure project is synced.</div>
            )}
          </div>

          {/* Blockers & Action Items */}
          <div className="lg:col-span-2 bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-brand-400" />
                Active Blockers & Risk Signals
              </h2>

              {readinessLoading ? (
                <SkeletonCard count={2} />
              ) : readiness?.blockers && readiness.blockers.length > 0 ? (
                <div className="space-y-3">
                  {readiness.blockers.map((b, i) => (
                    <div key={i} className="flex gap-3 p-3.5 rounded-lg bg-red-500/5 border border-red-500/10">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-red-300 leading-relaxed">{b}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <p className="text-xs text-emerald-400">All release gates looking good. No blockers detected!</p>
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-white/5 pt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">Last Sync: Live data</span>
              <button
                onClick={(e) => handleSyncRepo(selectedProject._id, e)}
                disabled={syncingId === selectedProject._id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
              >
                {syncingId === selectedProject._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Force Codebase Sync
              </button>
            </div>
          </div>
        </div>

        {/* Project Meta Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface-700/50 border border-white/5 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase">Criticality</h3>
            <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase border ${
              selectedProject.criticality === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
              selectedProject.criticality === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
              selectedProject.criticality === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
              'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {selectedProject.criticality}
            </span>
          </div>

          <div className="bg-surface-700/50 border border-white/5 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase">Tech Stack</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedProject.techStack?.map((tech, i) => (
                <span key={i} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[11px] text-slate-300 capitalize">{tech}</span>
              ))}
            </div>
          </div>

          <div className="bg-surface-700/50 border border-white/5 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase">GitHub Repository</h3>
            <span className="block mt-2 font-mono text-xs text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">
              {selectedProject.githubRepo || 'No repo attached'}
            </span>
          </div>
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
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Manage software release streams and codebase metrics</p>
        </div>

        {/* Create Button (Admin/Manager only) */}
        {user && (user.role === 'admin' || user.role === 'manager') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 btn-primary text-xs"
          >
            <Plus className="w-4 h-4" /> Create Project
          </button>
        )}
      </div>

      {/* Grid of Projects */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard count={3} />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-surface-700/50 border border-white/5 rounded-xl p-12 text-center text-sm text-slate-500">
          No projects configured yet. Click &quot;Create Project&quot; to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const teamName = typeof project.teamId === 'object' && project.teamId !== null ? (project.teamId as Team).name : '';
            return (
              <div
                key={project._id}
                onClick={() => selectProject(project)}
                className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-5 hover:bg-white/[.02] cursor-pointer transition-all hover:border-white/10 group flex flex-col justify-between h-48"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-200 group-hover:text-brand-400 transition-colors truncate">{project.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase border ${
                      project.criticality === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      project.criticality === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                      project.criticality === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {project.criticality}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{project.description || 'No description provided.'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">{teamName}</span>
                  <button
                    onClick={(e) => handleSyncRepo(project._id, e)}
                    disabled={syncingId === project._id}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors disabled:opacity-50"
                  >
                    {syncingId === project._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Sync
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface-800 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-surface-700/30">
              <h3 className="font-semibold text-white">Create New Project</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-xs">Close</button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="E.g. API Gateway"
                  required
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Short description of the project"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Owning Team</label>
                <select
                  value={newProject.teamId}
                  onChange={(e) => setNewProject({ ...newProject, teamId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-surface-700 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  <option value="">-- Select a Team --</option>
                  {teams.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">GitHub Repo Path</label>
                <input
                  type="text"
                  value={newProject.githubRepo}
                  onChange={(e) => setNewProject({ ...newProject, githubRepo: e.target.value })}
                  placeholder="owner/repository"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tech Stack (comma separated)</label>
                <input
                  type="text"
                  value={newProject.techStack}
                  onChange={(e) => setNewProject({ ...newProject, techStack: e.target.value })}
                  placeholder="typescript, react, nodejs"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Criticality</label>
                <select
                  value={newProject.criticality}
                  onChange={(e) => setNewProject({ ...newProject, criticality: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-700 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-all shadow-lg disabled:opacity-50 mt-2 text-sm"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Project'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
