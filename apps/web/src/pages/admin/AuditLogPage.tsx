import { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';
import { Layout } from '../../components/Layout';

interface AuditEntry {
  id: string;
  userId: string | null;
  eventType: string;
  provider: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const EVENT_TYPES = [
  'oauth_initiated',
  'oauth_callback_success',
  'oauth_callback_failure',
  'account_linked',
  'login',
  'logout',
  'token_refreshed',
  'token_replay_detected',
  'admin_credential_updated',
  'session_revoked_by_admin',
];

export function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState('');
  const [loading, setLoading] = useState(true);

  const pageSize = 50;

  useEffect(() => {
    loadAuditLog();
  }, [page, eventType]);

  const loadAuditLog = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAuditLog({
        page,
        pageSize,
        eventType: eventType || undefined,
      }) as { items: AuditEntry[]; total: number };
      setEntries(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatEventType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Layout>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1>Audit Log</h1>
        <select
          className="input"
          value={eventType}
          onChange={(e) => {
            setEventType(e.target.value);
            setPage(1);
          }}
          style={{ width: 200 }}
        >
          <option value="">All Events</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {formatEventType(type)}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner" />
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Time</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Event</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Provider</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>IP Address</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>User ID</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td
                        style={{
                          padding: '0.75rem',
                          fontSize: '0.875rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            background:
                              entry.eventType.includes('failure') ||
                              entry.eventType.includes('replay')
                                ? '#fef2f2'
                                : 'var(--bg)',
                            color:
                              entry.eventType.includes('failure') ||
                              entry.eventType.includes('replay')
                                ? 'var(--error)'
                                : 'var(--text)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                          }}
                        >
                          {formatEventType(entry.eventType)}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '0.75rem',
                          textTransform: 'capitalize',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {entry.provider || '-'}
                      </td>
                      <td
                        style={{
                          padding: '0.75rem',
                          fontSize: '0.875rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {entry.ipAddress || '-'}
                      </td>
                      <td
                        style={{
                          padding: '0.75rem',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {entry.userId ? entry.userId.slice(0, 8) + '...' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {entries.length === 0 && (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No audit log entries found
              </p>
            )}

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
