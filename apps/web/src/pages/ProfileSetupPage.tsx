import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

export function ProfileSetupPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { user: updatedUser } = await apiClient.completeProfile(name.trim());
      updateUser(updatedUser);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 450, marginTop: '10vh' }}>
      <div className="card">
        <h1 style={{ marginBottom: '0.5rem' }}>Complete Your Profile</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Just a few more details to get started
        </p>

        <form onSubmit={handleSubmit}>
          {user?.avatarUrl && (
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <img
                src={user.avatarUrl}
                alt="Profile"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  border: '3px solid var(--border)',
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="email"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              className="input"
              value={user?.email ?? ''}
              disabled
              style={{ backgroundColor: 'var(--bg)' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="name"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}
            >
              Display Name
            </label>
            <input
              type="text"
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              autoFocus
            />
          </div>

          {error && (
            <p className="error-text" style={{ marginBottom: '1rem' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
