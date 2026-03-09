import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div>
      <header
        style={{
          background: 'var(--card-bg)',
          borderBottom: '1px solid var(--border)',
          padding: '0 1rem',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: 60,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Link
              to="/"
              style={{
                fontWeight: 600,
                fontSize: '1.125rem',
                color: 'var(--text)',
                textDecoration: 'none',
              }}
            >
              OAuth Service
            </Link>

            <nav style={{ display: 'flex', gap: '1rem' }}>
              <Link
                to="/"
                style={{
                  color: location.pathname === '/' ? 'var(--primary)' : 'var(--text-muted)',
                  textDecoration: 'none',
                }}
              >
                Dashboard
              </Link>
              <Link
                to="/settings"
                style={{
                  color: location.pathname === '/settings' ? 'var(--primary)' : 'var(--text-muted)',
                  textDecoration: 'none',
                }}
              >
                Settings
              </Link>
              {user?.isAdmin && (
                <Link
                  to="/admin/stats"
                  style={{
                    color: isAdminRoute ? 'var(--primary)' : 'var(--text-muted)',
                    textDecoration: 'none',
                  }}
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user?.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt="Profile"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                }}
              />
            )}
            <button
              onClick={logout}
              className="btn btn-outline"
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {isAdminRoute && (
        <div
          style={{
            background: 'var(--card-bg)',
            borderBottom: '1px solid var(--border)',
            padding: '0 1rem',
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              display: 'flex',
              gap: '1.5rem',
              height: 48,
              alignItems: 'center',
            }}
          >
            <Link
              to="/admin/stats"
              style={{
                color: location.pathname === '/admin/stats' ? 'var(--primary)' : 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              Stats
            </Link>
            <Link
              to="/admin/users"
              style={{
                color: location.pathname === '/admin/users' ? 'var(--primary)' : 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              Users
            </Link>
            <Link
              to="/admin/oauth-apps"
              style={{
                color: location.pathname === '/admin/oauth-apps' ? 'var(--primary)' : 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              OAuth Apps
            </Link>
            <Link
              to="/admin/audit-log"
              style={{
                color: location.pathname === '/admin/audit-log' ? 'var(--primary)' : 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              Audit Log
            </Link>
          </div>
        </div>
      )}

      <main className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        {children}
      </main>
    </div>
  );
}
