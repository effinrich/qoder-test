import { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';
import { Layout } from '../../components/Layout';

interface OAuthApp {
  id: string;
  provider: string;
  clientId: string;
  scopes: string[];
  callbackUrl: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function AdminOAuthAppsPage() {
  const [apps, setApps] = useState<OAuthApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingApp, setEditingApp] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    clientId: '',
    clientSecret: '',
    enabled: true,
  });

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      const data = await apiClient.getOAuthApps() as { apps: OAuthApp[] };
      setApps(data.apps);
    } catch (err) {
      setError('Failed to load OAuth apps');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (app: OAuthApp) => {
    setEditingApp(app.provider);
    setEditForm({
      clientId: app.clientId,
      clientSecret: '',
      enabled: app.enabled,
    });
  };

  const handleSave = async (provider: string) => {
    try {
      const updates: Record<string, unknown> = {
        clientId: editForm.clientId,
        enabled: editForm.enabled,
      };
      if (editForm.clientSecret) {
        updates.clientSecret = editForm.clientSecret;
      }

      await apiClient.updateOAuthApp(provider, updates);
      await loadApps();
      setEditingApp(null);
    } catch (err) {
      setError('Failed to update OAuth app');
    }
  };

  const handleToggle = async (provider: string, enabled: boolean) => {
    try {
      await apiClient.updateOAuthApp(provider, { enabled });
      setApps(apps.map((app) =>
        app.provider === provider ? { ...app, enabled } : app
      ));
    } catch (err) {
      setError('Failed to toggle OAuth app');
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
      <h1 style={{ marginBottom: '1.5rem' }}>OAuth Apps</h1>

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {apps.map((app) => (
          <div key={app.id} className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <h2 style={{ textTransform: 'capitalize', marginBottom: '0.5rem' }}>
                  {app.provider}
                  {!app.enabled && (
                    <span
                      style={{
                        marginLeft: '0.75rem',
                        fontSize: '0.75rem',
                        background: 'var(--text-muted)',
                        color: 'white',
                        padding: '0.125rem 0.5rem',
                        borderRadius: 4,
                      }}
                    >
                      Disabled
                    </span>
                  )}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Callback: {app.callbackUrl}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-outline"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  onClick={() => handleToggle(app.provider, !app.enabled)}
                >
                  {app.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  className="btn btn-outline"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  onClick={() => handleEdit(app)}
                >
                  Edit
                </button>
              </div>
            </div>

            {editingApp === app.provider && (
              <div
                style={{
                  marginTop: '1.5rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'grid', gap: '1rem', maxWidth: 400 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                      Client ID
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={editForm.clientId}
                      onChange={(e) =>
                        setEditForm({ ...editForm, clientId: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                      Client Secret (leave blank to keep current)
                    </label>
                    <input
                      type="password"
                      className="input"
                      value={editForm.clientSecret}
                      onChange={(e) =>
                        setEditForm({ ...editForm, clientSecret: e.target.value })
                      }
                      placeholder="********"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSave(app.provider)}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => setEditingApp(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Scopes: {app.scopes.join(', ')}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Last updated: {new Date(app.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
