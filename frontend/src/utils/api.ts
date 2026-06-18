/**
 * API Layer
 * Axios instance with interceptors for JWT auth, error handling, and typed API functions.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import type {
  ApiResponse,
  AuthResponse,
  User,
  Sprint,
  PullRequest,
  Team,
  Project,
  DashboardData,
  AnalyzeResult,
  BenchmarkResult,
  Hotspot,
  ReleaseReadiness,
  SkillHeatmapEntry,
  RiskTimelineEntry,
  RiskPrediction,
  Pagination,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Axios Instance ─────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor: Attach JWT ────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('delivery_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor: Handle 401 + Errors ──────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { message?: string } }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('delivery_token');
      localStorage.removeItem('delivery_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (!error.response) {
      toast.error('Network error — please check your connection.');
    }
    return Promise.reject(error);
  }
);

// ── Auth API ───────────────────────────────────────────────
export const authAPI = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password }),

  register: (data: { name: string; email: string; password: string; organizationId?: string; role?: string }) =>
    api.post<AuthResponse>('/api/auth/register', data),

  getMe: () =>
    api.get<ApiResponse<{ user: User }>>('/api/auth/me'),

  logout: () =>
    api.post<ApiResponse<{ message: string }>>('/api/auth/logout'),

  updateProfile: (data: { name?: string; githubUsername?: string }) =>
    api.put<ApiResponse<{ user: User }>>('/api/auth/profile', data),
};

// ── Sprint API ─────────────────────────────────────────────
export const sprintAPI = {
  getSprint: (sprintId: string) =>
    api.get<ApiResponse<{ sprint: Sprint; pullRequests: PullRequest[] }>>(`/api/sprints/${sprintId}`),

  getTeamSprints: (teamId: string, params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<{ sprints: Sprint[]; pagination: Pagination }>>(`/api/sprints/team/${teamId}`, { params }),

  createSprint: (data: { name: string; teamId: string; projectId: string; startDate: string; endDate: string; plannedPoints?: number }) =>
    api.post<ApiResponse<{ sprint: Sprint }>>('/api/sprints', data),

  updateSprint: (sprintId: string, data: Partial<Sprint>) =>
    api.put<ApiResponse<{ sprint: Sprint }>>(`/api/sprints/${sprintId}`, data),

  analyzeSprint: (sprintId: string) =>
    api.post<ApiResponse<AnalyzeResult>>(`/api/sprints/${sprintId}/analyze`),

  getRiskHistory: (sprintId: string) =>
    api.get<ApiResponse<{ predictions: RiskPrediction[] }>>(`/api/sprints/${sprintId}/risk-history`),

  batchPRAnalyze: (sprintId: string) =>
    api.post<ApiResponse<{ message: string; count: number }>>(`/api/sprints/${sprintId}/batch-pr-analyze`),

  analyzeAllPRs: (sprintId: string) =>
    api.post<ApiResponse<{ message: string; count: number; patternsDetected: string; riskLevel: string }>>(`/api/sprints/${sprintId}/analyze-all-prs`),
};

// ── Project API ────────────────────────────────────────────
export const projectAPI = {
  getProjects: (params?: { organizationId?: string; status?: string; teamId?: string }) =>
    api.get<ApiResponse<{ projects: Project[] }>>('/api/projects', { params }),

  getProject: (projectId: string) =>
    api.get<ApiResponse<{ project: Project }>>(`/api/projects/${projectId}`),

  createProject: (data: Partial<Project>) =>
    api.post<ApiResponse<{ project: Project }>>('/api/projects', data),

  updateProject: (projectId: string, data: Partial<Project>) =>
    api.put<ApiResponse<{ project: Project }>>(`/api/projects/${projectId}`, data),
};

// ── Team API ───────────────────────────────────────────────
export const teamAPI = {
  getTeams: (organizationId?: string) =>
    api.get<ApiResponse<{ teams: Team[] }>>('/api/teams', { params: organizationId ? { organizationId } : {} }),

  getTeam: (teamId: string) =>
    api.get<ApiResponse<{ team: Team }>>(`/api/teams/${teamId}`),

  createTeam: (data: Partial<Team>) =>
    api.post<ApiResponse<{ team: Team }>>('/api/teams', data),

  updateTeam: (teamId: string, data: Partial<Team>) =>
    api.put<ApiResponse<{ team: Team }>>(`/api/teams/${teamId}`, data),
};

// ── Analytics API ──────────────────────────────────────────
export const analyticsAPI = {
  getDashboard: (organizationId: string) =>
    api.get<ApiResponse<DashboardData>>(`/api/analytics/dashboard/${organizationId}`),

  getTeamBenchmark: (teamId: string) =>
    api.get<ApiResponse<BenchmarkResult>>(`/api/analytics/team/${teamId}/benchmark`),

  getSkillHeatmap: (organizationId: string) =>
    api.get<ApiResponse<{ heatmap: SkillHeatmapEntry[] }>>(`/api/analytics/org/${organizationId}/skill-heatmap`),

  getRiskTimeline: (sprintId: string) =>
    api.get<ApiResponse<{ timeline: RiskTimelineEntry[] }>>(`/api/analytics/sprint/${sprintId}/risk-timeline`),

  getReleaseReadiness: (projectId: string) =>
    api.get<ApiResponse<ReleaseReadiness>>(`/api/analytics/release-readiness/${projectId}`),

  getDashboardSummary: () =>
    api.get<ApiResponse<{ teamCount: number; projectCount: number; activeSprintCount: number; atRiskCount: number }>>('/api/dashboard/summary'),

  getLeaderboard: (organizationId: string) =>
    api.get<ApiResponse<Array<{ teamId: string; name: string; healthScore: number; percentileRank: number; period: string }>>>(`/api/analytics/leaderboard/${organizationId}`),

  getStaffingHistory: (teamId: string) =>
    api.get<ApiResponse<any>>(`/api/analytics/staffing-history/${teamId}`),
};

// ── GitHub API ─────────────────────────────────────────────
export const githubAPI = {
  syncProject: (projectId: string) =>
    api.post<ApiResponse<{ synced: boolean; commitsAdded: number; prsAdded: number; lastSyncAt: string }>>(`/api/github/sync/${projectId}`),

  analyzePR: (prId: string) =>
    api.post<ApiResponse<{ summary: string; riskLevel: string; riskFlags: string[]; touchesAuth: boolean; reviewerNote: string }>>(`/api/github/analyze-pr/${prId}`),

  analyzeHotspots: (projectId: string) =>
    api.get<ApiResponse<{ totalFilesAnalyzed: number; hotspotCount: number; hotspots: Hotspot[] }>>(`/api/github/analyze-hotspots/${projectId}`),
};

export default api;
