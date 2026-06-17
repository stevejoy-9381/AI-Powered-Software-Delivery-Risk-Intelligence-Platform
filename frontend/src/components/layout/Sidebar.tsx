/**
 * Sidebar Component
 * Persistent navigation sidebar with lucide-react icons and active link highlighting.
 */
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderGit,
  BarChart2,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/teams', label: 'My Teams', icon: Users },
  { to: '/projects', label: 'Projects', icon: FolderGit },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-800/80 backdrop-blur-xl border-r border-white/5 flex flex-col z-50">
      {/* ── Logo ─────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight">DeliveryRisk</h1>
          <p className="text-[10px] text-brand-400 font-medium tracking-widest uppercase">AI Platform</p>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-brand-500/15 text-brand-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span>{label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── User Section ─────────────────────────── */}
      <div className="border-t border-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name || 'User'}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.role || 'developer'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
