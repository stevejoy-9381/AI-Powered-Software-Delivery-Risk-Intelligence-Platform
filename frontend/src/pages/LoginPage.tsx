/**
 * LoginPage
 * Clean centered card with email/password fields and GitHub OAuth button.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Github, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) navigate('/dashboard');
  };

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-2xl shadow-brand-500/30">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to DeliveryRisk AI</p>
        </div>

        {/* Card */}
        <div className="bg-surface-700/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  placeholder="••••••••"
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium rounded-lg hover:from-brand-600 hover:to-brand-700 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-surface-700/50 text-xs text-slate-600">or</span>
            </div>
          </div>

          {/* GitHub OAuth */}
          <a
            href={`${API_URL}/api/auth/github`}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 text-slate-300 font-medium rounded-lg hover:bg-white/10 transition-all text-sm"
          >
            <Github className="w-4 h-4" />
            Continue with GitHub
          </a>

          {/* Demo credentials hint */}
          <div className="mt-4 p-3 rounded-lg bg-brand-500/5 border border-brand-500/10">
            <p className="text-[11px] text-brand-400 text-center">
              Demo: <span className="font-mono">admin@demo.com</span> / <span className="font-mono">Demo@123</span>
            </p>
          </div>
        </div>

        {/* Register link */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
