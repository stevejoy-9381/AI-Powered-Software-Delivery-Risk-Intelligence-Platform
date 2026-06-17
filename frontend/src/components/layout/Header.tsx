/**
 * Header Component
 * Top header bar with breadcrumb context and user info.
 */
import { Bell, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Header() {
  const { user } = useAuth();

  return (
    <header className="h-16 border-b border-white/5 bg-surface-800/50 backdrop-blur-lg flex items-center justify-between px-6 sticky top-0 z-40">
      {/* ── Search ────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search sprints, teams, projects..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all"
          />
        </div>
      </div>

      {/* ── Right Side ───────────────────────────── */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User Info */}
        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-200">{user?.name || 'User'}</p>
            <p className="text-[11px] text-slate-500">{user?.email || ''}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white ring-2 ring-brand-500/20">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
