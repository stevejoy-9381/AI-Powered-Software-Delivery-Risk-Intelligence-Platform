/**
 * RegisterPage
 * Registration form with name, email, password, role selector.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [role, setRole] = useState('developer');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const ok = await register({ name, email, password, role });
    setLoading(false);
    if (ok) navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-2xl shadow-brand-500/30">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-sm text-slate-500 mt-1">Join DeliveryRisk AI</p>
        </div>

        {/* Card */}
        <div className="bg-surface-700/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all"
              >
                <option value="developer" className="bg-surface-800">Developer</option>
                <option value="manager" className="bg-surface-800">Manager</option>
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium rounded-lg hover:from-brand-600 hover:to-brand-700 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Login link */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
