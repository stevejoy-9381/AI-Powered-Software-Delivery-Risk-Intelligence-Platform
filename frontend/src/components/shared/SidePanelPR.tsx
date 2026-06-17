/**
 * SidePanelPR Component
 * Slide-in panel from the right for PR details with LLM summary.
 */
import { X, GitPullRequest, Shield, TestTube2, FileText } from 'lucide-react';
import type { PullRequest } from '../../types';

interface Props {
  pr: PullRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function SidePanelPR({ pr, isOpen, onClose }: Props) {
  if (!pr) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-[480px] bg-surface-800 border-l border-white/10 z-50 transform transition-transform duration-300 ease-out shadow-2xl ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <GitPullRequest className="w-5 h-5 text-brand-400" />
            <span className="text-sm font-semibold text-slate-200">PR #{pr.githubPrNumber}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-65px)] p-6 space-y-6">
          {/* Title */}
          <div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">{pr.title}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>by {pr.author}</span>
              <span>•</span>
              <span className="text-emerald-400">+{pr.additions}</span>
              <span className="text-red-400">-{pr.deletions}</span>
              <span>•</span>
              <span className={`capitalize ${pr.status === 'merged' ? 'text-purple-400' : pr.status === 'open' ? 'text-emerald-400' : 'text-slate-500'}`}>
                {pr.status}
              </span>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {pr.touchesAuthLogic && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 text-xs font-medium">
                <Shield className="w-3 h-3" /> Touches Auth
              </span>
            )}
            {pr.hasTests && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                <TestTube2 className="w-3 h-3" /> Has Tests
              </span>
            )}
            {!pr.hasTests && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium">
                <TestTube2 className="w-3 h-3" /> No Tests
              </span>
            )}
            {pr.isLargeDiff && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 text-xs font-medium">
                <FileText className="w-3 h-3" /> Large Diff
              </span>
            )}
          </div>

          {/* Risk Flags */}
          {pr.riskFlags && pr.riskFlags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Risk Flags</h4>
              <div className="flex flex-wrap gap-1.5">
                {pr.riskFlags.map((flag, i) => {
                  const isAuth = /auth|security|session|token/i.test(flag);
                  const isScope = /scope|large|size/i.test(flag);
                  const color = isAuth ? 'bg-red-500/15 text-red-400' : isScope ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400';
                  return (
                    <span key={i} className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}>
                      {flag}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* LLM Summary */}
          {pr.llmSummary && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">AI Summary</h4>
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <p className="text-sm text-slate-300 leading-relaxed">{pr.llmSummary}</p>
              </div>
            </div>
          )}

          {/* Review Lag */}
          {pr.reviewLagHours != null && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Review Metrics</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-[11px] text-slate-500">Review Lag</p>
                  <p className={`text-lg font-bold ${pr.reviewLagHours > 24 ? 'text-red-400' : 'text-slate-200'}`}>
                    {pr.reviewLagHours.toFixed(1)}h
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-[11px] text-slate-500">Files Changed</p>
                  <p className="text-lg font-bold text-slate-200">{pr.filesChanged?.length || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* Files Changed */}
          {pr.filesChanged && pr.filesChanged.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Files ({pr.filesChanged.length})
              </h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {pr.filesChanged.map((file, i) => (
                  <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-white/[.02] hover:bg-white/5">
                    <span className="text-slate-400 truncate flex-1 mr-4 font-mono">{file.filename}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">+{file.additions}</span>
                      <span className="text-red-400">-{file.deletions}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
