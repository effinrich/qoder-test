import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <Layout>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user?.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt="Profile"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  border: '2px solid var(--border)',
                }}
              />
            )}
            <div>
              <h1 style={{ marginBottom: '0.25rem' }}>
                Welcome, {user?.name || 'User'}
              </h1>
              <p style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Quick Actions</h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/settings" className="btn btn-outline">
              Account Settings
            </Link>
            {user?.isAdmin && (
              <Link to="/admin/stats" className="btn btn-outline">
                Admin Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
