import { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';
import { Layout } from '../../components/Layout';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const pageSize = 20;

  useEffect(() => {
    loadUsers();
  }, [page, search]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getUsers({ page, pageSize, search }) as {
        items: User[];
        total: number;
      };
      setUsers(data.items);
      setTotal(data.total);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeUser = async (userId: string) => {
    if (!confirm('Revoke all sessions for this user?')) return;

    try {
      const { revokedCount } = await apiClient.revokeUserSessions(userId);
      alert(`Revoked ${revokedCount} session(s)`);
    } catch (err) {
      alert('Failed to revoke sessions');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Users</h1>
        <input
          type="text"
          className="input"
          placeholder="Search users..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ width: 250 }}
        />
      </div>

      {error && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="error-text">{error}</p>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner" />
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>User</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Created</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Last Login</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {user.avatarUrl && (
                          <img
                            src={user.avatarUrl}
                            alt=""
                            style={{ width: 32, height: 32, borderRadius: '50%' }}
                          />
                        )}
                        <div>
                          <p style={{ fontWeight: 500 }}>
                            {user.name || 'No name'}
                            {user.isAdmin && (
                              <span
                                style={{
                                  marginLeft: '0.5rem',
                                  fontSize: '0.75rem',
                                  background: 'var(--primary)',
                                  color: 'white',
                                  padding: '0.125rem 0.5rem',
                                  borderRadius: 4,
                                }}
                              >
                                Admin
                              </span>
                            )}
                          </p>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => handleRevokeUser(user.id)}
                      >
                        Revoke Sessions
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '1rem',
                }}
              >
                <button
                  className="btn btn-outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span style={{ padding: '0.5rem 1rem' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
