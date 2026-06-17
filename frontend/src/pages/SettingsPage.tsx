/**
 * SettingsPage
 * Configurations for user profile, organization info, and platform settings.
 */
import { useState } from 'react';
import {
  User, Shield, Github, Save, Info, Database
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    githubUsername: user?.githubUsername || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await updateProfile({
      name: profile.name,
      githubUsername: profile.githubUsername,
    });
    setLoading(false);
    if (success) {
      toast.success('Profile configurations saved successfully.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure profile settings and third-party API integrations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation / Cards */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-5 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-xl shadow-brand-500/10">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mt-3">{profile.name}</h3>
            <span className="text-[10px] uppercase font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20 mt-1.5">
              {user?.role || 'Developer'}
            </span>
          </div>

          <div className="bg-surface-700/50 border border-white/5 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase">Platform Configs</h4>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Shield className="w-4 h-4 text-brand-400" />
              Role: <span className="font-semibold text-white capitalize">{user?.role}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Database className="w-4 h-4 text-brand-400" />
              Database: <span className="font-semibold text-white">Online</span>
            </div>
          </div>
        </div>

        {/* Form Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile form */}
          <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-brand-400" />
              User Profile
            </h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <Github className="w-3.5 h-3.5" /> GitHub Username
                </label>
                <input
                  type="text"
                  value={profile.githubUsername}
                  onChange={(e) => setProfile({ ...profile, githubUsername: e.target.value })}
                  placeholder="e.g. torvalds"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 btn-primary text-xs"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Configurations
                </button>
              </div>
            </form>
          </div>

          {/* GitHub Integration details */}
          <div className="bg-surface-700/50 backdrop-blur-sm border border-white/5 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Github className="w-4 h-4 text-brand-400" />
              GitHub App Configurations
            </h3>
            <div className="p-4 bg-brand-500/5 border border-brand-500/10 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Authentication and synchronization use global OAuth applications. Developers can connect their profiles to sync commits, tickets, and PR metrics directly into our ML model.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Active Connection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
