/**
 * App Root Component
 * Sets up routing and global providers.
 * Pages and routes will be added in subsequent phases.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import SprintDetailPage from './pages/SprintDetailPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProjectPage from './pages/ProjectPage';
import TeamPage from './pages/TeamPage';
import SettingsPage from './pages/SettingsPage';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Main Layout Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="sprints/:sprintId" element={<SprintDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="projects" element={<ProjectPage />} />
            <Route path="teams" element={<TeamPage />} />
            <Route path="teams/:teamId" element={<TeamPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
