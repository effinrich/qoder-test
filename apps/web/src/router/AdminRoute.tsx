import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import type { ReactNode } from 'react';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <ProtectedRoute requireProfileComplete>
      {user?.isAdmin ? children : <Navigate to="/" replace />}
    </ProtectedRoute>
  );
}
