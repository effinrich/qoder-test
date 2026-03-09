import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireProfileComplete?: boolean;
}

export function ProtectedRoute({
  children,
  requireProfileComplete = false,
}: ProtectedRouteProps) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === 'needs-profile-setup' && requireProfileComplete) {
    return <Navigate to="/profile-setup" replace />;
  }

  if (requireProfileComplete && user && !user.profileComplete) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
}
