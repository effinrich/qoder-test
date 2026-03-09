import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './router/ProtectedRoute';
import { AdminRoute } from './router/AdminRoute';
import { LoginPage } from './pages/LoginPage';
import { CallbackPage } from './pages/CallbackPage';
import { ProfileSetupPage } from './pages/ProfileSetupPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminUsersPage } from './pages/admin/UsersPage';
import { AdminOAuthAppsPage } from './pages/admin/OAuthAppsPage';
import { AdminAuditLogPage } from './pages/admin/AuditLogPage';
import { AdminStatsPage } from './pages/admin/StatsPage';

export function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />
      
      <Route
        path="/profile-setup"
        element={
          <ProtectedRoute>
            <ProfileSetupPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/"
        element={
          <ProtectedRoute requireProfileComplete>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/settings"
        element={
          <ProtectedRoute requireProfileComplete>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminUsersPage />
          </AdminRoute>
        }
      />
      
      <Route
        path="/admin/oauth-apps"
        element={
          <AdminRoute>
            <AdminOAuthAppsPage />
          </AdminRoute>
        }
      />
      
      <Route
        path="/admin/audit-log"
        element={
          <AdminRoute>
            <AdminAuditLogPage />
          </AdminRoute>
        }
      />
      
      <Route
        path="/admin/stats"
        element={
          <AdminRoute>
            <AdminStatsPage />
          </AdminRoute>
        }
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
