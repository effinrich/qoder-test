import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function CallbackPage() {
  const navigate = useNavigate();
  const { refreshSession, status } = useAuth();

  useEffect(() => {
    refreshSession();
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/');
    } else if (status === 'needs-profile-setup') {
      navigate('/profile-setup');
    } else if (status === 'unauthenticated') {
      navigate('/login?error=auth_failed');
    }
  }, [status, navigate]);

  return (
    <div className="container" style={{ textAlign: 'center', marginTop: '20vh' }}>
      <div className="spinner" style={{ margin: '0 auto 1rem' }} />
      <p style={{ color: 'var(--text-muted)' }}>Completing sign in...</p>
    </div>
  );
}
