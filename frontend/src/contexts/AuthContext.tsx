/**
 * Auth Context
 * Manages authentication state across the app — JWT storage, login, logout, register.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authAPI } from '../utils/api';
import type { User } from '../types';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: { name: string; email: string; password: string; organizationId?: string; role?: string }) => Promise<boolean>;
  logout: () => void;
  setAuthFromToken: (token: string) => Promise<void>;
  updateProfile: (data: { name?: string; githubUsername?: string }) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('delivery_token'));
  const [isLoading, setIsLoading] = useState(true);

  // ── Load user on mount if token exists ───────────────────
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await authAPI.getMe();
        setUser(res.data.data.user);
      } catch {
        localStorage.removeItem('delivery_token');
        localStorage.removeItem('delivery_user');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  // ── Login ────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await authAPI.login(email, password);
      const { token: newToken, user: newUser } = res.data.data;
      localStorage.setItem('delivery_token', newToken);
      localStorage.setItem('delivery_user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      toast.success(`Welcome back, ${newUser.name}!`);
      return true;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Login failed.');
      return false;
    }
  }, []);

  // ── Register ─────────────────────────────────────────────
  const register = useCallback(async (data: { name: string; email: string; password: string; organizationId?: string; role?: string }): Promise<boolean> => {
    try {
      const res = await authAPI.register(data);
      const { token: newToken, user: newUser } = res.data.data;
      localStorage.setItem('delivery_token', newToken);
      localStorage.setItem('delivery_user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      toast.success(`Welcome, ${newUser.name}! Account created.`);
      return true;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Registration failed.');
      return false;
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────
  const logout = useCallback(() => {
    authAPI.logout().catch(() => {});
    localStorage.removeItem('delivery_token');
    localStorage.removeItem('delivery_user');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully.');
  }, []);

  // ── Set auth from token (for OAuth callback) ─────────────
  const setAuthFromToken = useCallback(async (newToken: string) => {
    localStorage.setItem('delivery_token', newToken);
    setToken(newToken);
    try {
      const res = await authAPI.getMe();
      setUser(res.data.data.user);
    } catch {
      logout();
    }
  }, [logout]);

  // ── Update Profile ───────────────────────────────────────
  const updateProfile = useCallback(async (data: { name?: string; githubUsername?: string }): Promise<boolean> => {
    try {
      const res = await authAPI.updateProfile(data);
      const updatedUser = res.data.data.user;
      localStorage.setItem('delivery_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return true;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to update profile.');
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
        setAuthFromToken,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
