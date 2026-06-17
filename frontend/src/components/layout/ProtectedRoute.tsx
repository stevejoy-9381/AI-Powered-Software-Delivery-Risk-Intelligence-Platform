/**
 * ProtectedRoute Component
 * Checks for JWT in localStorage and redirects to /login if not found.
 * Shows a loading spinner while verifying token.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Zap } from 'lucide-react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-2xl shadow-brand-500/30 animate-pulse">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-400 text-sm">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
