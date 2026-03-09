import { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';
import { Layout } from '../../components/Layout';
import type { AuthStats } from '@oauth-service/shared-types';

export function AdminStatsPage() {
  const [stats, setStats] = useState<AuthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await apiClient.getStats();
      setStats(data as AuthStats);
    } catch (err) {
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">
          <div className="spinner" />
        </div>
      </Layout>
    );
  }

  if (error || !stats) {
    return (
      <Layout>
        <div className="card">
          <p className="error-text">{error || 'Failed to load stats'}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 style={{ marginBottom: '1.5rem' }}>Dashboard</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="card">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Total Users
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 600 }}>{stats.totalUsers}</p>
        </div>

        <div className="card">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Active Sessions
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 600 }}>{stats.activeSessions}</p>
        </div>

        <div className="card">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Logins Today
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 600 }}>{stats.loginsToday}</p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Users by Provider</h2>
        <div style={{ display: 'flex', gap: '2rem' }}>
          {Object.entries(stats.loginsByProvider).map(([provider, count]) => (
            <div key={provider}>
              <p style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                {provider}
              </p>
              <p style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>
                {count}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
