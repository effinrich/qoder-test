import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { Layout } from '../components/Layout';

interface Connection {
  id: string;
  provider: string;
  providerUid: string;
  email: string | null;
  createdAt: string;
}

interface Session {
  id: string;
  issuedAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
}

export function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [connectionsData, sessionsData] = await Promise.all([
        apiClient.getConnections(),
        apiClient.getSessions(),
      ]);
      setConnections(connectionsData.connections);
      setSessions(sessionsData.sessions);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { user: updatedUser } = await apiClient.updateProfile({ name });
      updateUser(updatedUser);
      setSuccess('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkProvider = async (provider: string) => {
    if (connections.length <= 1) {
      setError('Cannot unlink the only login method');
      return;
    }

    if (!confirm(`Unlink ${provider}? You won't be able to log in with this provider.`)) {
      return;
    }

    try {
      await apiClient.unlinkProvider(provider);
      setConnections(connections.filter((c) => c.provider !== provider));
      setSuccess(`${provider} unlinked`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink provider');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiClient.revokeSession(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      setSuccess('Session revoked');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!confirm('This will sign you out of all other devices. Continue?')) {
      return;
    }

    try {
      const { revokedCount } = await apiClient.revokeOtherSessions();
      await loadData();
      setSuccess(`Revoked ${revokedCount} session(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
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

  return (
    <Layout>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Account Settings</h1>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              padding: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <p className="error-text">{error}</p>
          </div>
        )}

        {success && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              padding: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <p style={{ color: 'var(--success)' }}>{success}</p>
          </div>
        )}

        {/* Profile Section */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Profile</h2>
          <form onSubmit={handleUpdateProfile}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Email
              </label>
              <input
                type="email"
                className="input"
                value={user?.email ?? ''}
                disabled
                style={{ backgroundColor: 'var(--bg)' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Display Name
              </label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Connected Accounts */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Connected Accounts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {connections.map((connection) => (
              <div
                key={connection.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  background: 'var(--bg)',
                  borderRadius: 6,
                }}
              >
                <div>
                  <p style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                    {connection.provider}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {connection.email || connection.providerUid}
                  </p>
                </div>
                <button
                  className="btn btn-outline"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  onClick={() => handleUnlinkProvider(connection.provider)}
                  disabled={connections.length <= 1}
                >
                  Unlink
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Active Sessions */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Active Sessions</h2>
            {sessions.length > 1 && (
              <button
                className="btn btn-outline"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                onClick={handleRevokeOtherSessions}
              >
                Sign out others
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sessions.map((session, index) => (
              <div
                key={session.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  background: 'var(--bg)',
                  borderRadius: 6,
                }}
              >
                <div>
                  <p style={{ fontWeight: 500 }}>
                    {session.ipAddress}
                    {index === 0 && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--success)' }}>
                        Current
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {new Date(session.issuedAt).toLocaleDateString()}
                  </p>
                </div>
                {index !== 0 && (
                  <button
                    className="btn btn-outline"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    onClick={() => handleRevokeSession(session.id)}
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card" style={{ borderColor: '#fecaca' }}>
          <h2 style={{ marginBottom: '1rem', color: 'var(--error)' }}>
            Danger Zone
          </h2>
          <button
            className="btn"
            style={{
              backgroundColor: 'var(--error)',
              color: 'white',
            }}
            onClick={logout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </Layout>
  );
}
