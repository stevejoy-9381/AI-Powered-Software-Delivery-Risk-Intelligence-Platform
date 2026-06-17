/**
 * TypeScript Type Definitions
 * Shared interfaces for the DeliveryRisk AI frontend.
 */

// ── Auth Types ─────────────────────────────────────────────
export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'developer';
  avatar?: string;
  githubUsername?: string;
  organizationId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: User;
  };
}

// ── Organization ───────────────────────────────────────────
export interface Organization {
  _id: string;
  name: string;
  domain: string;
  plan: string;
}

// ── Team Types ─────────────────────────────────────────────
export interface TeamMember {
  userId: User | string;
  role: 'lead' | 'senior' | 'mid' | 'junior';
  name?: string;
  email?: string;
  githubUsername?: string;
  avatar?: string;
}

export interface Team {
  _id: string;
  name: string;
  organizationId: string;
  managerId?: User | string;
  members: TeamMember[];
  isActive: boolean;
  createdAt: string;
}

// ── Project Types ──────────────────────────────────────────
export interface Project {
  _id: string;
  name: string;
  description?: string;
  teamId: Team | string;
  organizationId: string;
  githubRepo?: string;
  techStack: string[];
  criticality: 'low' | 'medium' | 'high' | 'critical';
  domain?: string;
  status: 'active' | 'archived' | 'planning';
  isActive: boolean;
  createdAt: string;
}

// ── Sprint Types ───────────────────────────────────────────
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Ticket {
  ticketId: string;
  title: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'reopened';
  assignee?: string;
  storyPoints: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  labels: string[];
  addedMidSprint: boolean;
  reopenedCount: number;
}

export interface CommitSummary {
  sha: string;
  author: string;
  message: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  timestamp: string;
}

export interface PRSummary {
  prId: string;
  title: string;
  status: 'open' | 'merged' | 'closed';
  author: string;
}

export interface Sprint {
  _id: string;
  name: string;
  teamId: Team | string;
  projectId: Project | string;
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  plannedPoints: number;
  completedPoints: number;
  tickets: Ticket[];
  commits: CommitSummary[];
  pullRequests: PRSummary[];
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  riskFactors: string[];
  wasDelayed: boolean;
  delayDays: number;
  commitFrequency: number;
  codeChurnRate: number;
  completionPercentage: number;
  daysRemaining: number;
  createdAt: string;
}

// ── Pull Request Types ─────────────────────────────────────
export interface PullRequest {
  _id: string;
  sprintId: string;
  projectId: string;
  githubPrNumber: number;
  title: string;
  description: string;
  author: string;
  additions: number;
  deletions: number;
  status: 'open' | 'merged' | 'closed';
  mergedAt?: string;
  closedAt?: string;
  reviewLagHours?: number;
  hasTests: boolean;
  touchesAuthLogic: boolean;
  isLargeDiff: boolean;
  filesChanged: Array<{ filename: string; additions: number; deletions: number }>;
  llmSummary?: string;
  riskFlags: string[];
  createdAt: string;
}

// ── Risk & Analytics Types ─────────────────────────────────
export interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  value?: number;
}

export interface RiskPrediction {
  predicted_risk_score: number;
  predicted_delay: boolean;
  confidence: number;
  risk_factors: string;
  created_at: string;
}

export interface AnalyzeResult {
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  riskFactors: RiskFactor[];
  predictedDelay: boolean;
  confidence: number;
  staffingSignals: StaffingResult | null;
  features: Record<string, number> | null;
  nlpAnalysis: Record<string, unknown> | null;
}

export interface StaffingResult {
  bottlenecks: StaffingBottleneck[];
  bus_factor_risk: boolean;
  critical_person?: string;
  staffing_recommendation: string;
}

export interface StaffingBottleneck {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  impact_estimate?: string;
  historical_evidence?: string;
}

// ── Dashboard Types ────────────────────────────────────────
export interface DashboardData {
  totalActiveSprints: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
    unscored: number;
  };
  avgHealthScore: number;
  avgRiskScore: number;
  criticalSprints: CriticalSprint[];
  teamCount: number;
  projectCount: number;
}

export interface CriticalSprint {
  sprintId: string;
  name: string;
  team: string;
  project: string;
  riskScore: number;
  riskLevel: RiskLevel;
  daysRemaining: number;
}

// ── Benchmark Types ────────────────────────────────────────
export interface BenchmarkResult {
  healthScore: number;
  healthGrade: string;
  percentile: number | null;
  breakdown: Array<{ category: string; score: number; weight: number; details: string }>;
  recommendations: string[];
  history: Array<{ period: string; delivery_health_score: number; percentile_rank: number }>;
}

// ── Hotspot Types ──────────────────────────────────────────
export interface Hotspot {
  file_path: string;
  hotspot_score: number;
  is_hotspot: boolean;
  churn_count?: number;
  has_tests?: boolean;
  test_coverage_percent?: number;
  authors_count?: number;
  complexity_score?: number;
  breakdown?: {
    churn_score: number;
    test_penalty: number;
    complexity_score: number;
    authors_score: number;
    critical_multiplier: number;
  };
}

// ── Release Readiness Types ────────────────────────────────
export interface ReleaseReadiness {
  readinessScore: number;
  blockers: string[];
  recommendation: string;
  sprintRiskScore: number;
  hotspotCount: number;
  openCriticalPRs: number;
}

// ── Skill Heatmap Types ────────────────────────────────────
export interface SkillHeatmapEntry {
  techStack: string;
  delayRate: number;
  avgRiskScore: number;
  sprintCount: number;
}

// ── Risk Timeline Types ────────────────────────────────────
export interface RiskTimelineEntry {
  riskScore: number;
  predictedDelay: boolean;
  confidence: number;
  riskFactors: string;
  timestamp: string;
}

// ── API Response Wrapper ───────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    statusCode?: number;
  };
}

// ── Pagination ─────────────────────────────────────────────
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
