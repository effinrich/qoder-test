import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from 'react';
import type { AuthUser, SessionStatus } from '@oauth-service/shared-types';
import { apiClient } from '../services/apiClient';

interface AuthState {
  status: SessionStatus;
  user: AuthUser | null;
  error: string | null;
}

type AuthAction =
  | { type: 'LOADING' }
  | { type: 'AUTHENTICATED'; user: AuthUser }
  | { type: 'NEEDS_PROFILE_SETUP'; user: AuthUser }
  | { type: 'UNAUTHENTICATED' }
  | { type: 'ERROR'; error: string }
  | { type: 'UPDATE_USER'; user: AuthUser };

const initialState: AuthState = {
  status: 'loading',
  user: null,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, status: 'loading', error: null };
    case 'AUTHENTICATED':
      return { status: 'authenticated', user: action.user, error: null };
    case 'NEEDS_PROFILE_SETUP':
      return { status: 'needs-profile-setup', user: action.user, error: null };
    case 'UNAUTHENTICATED':
      return { status: 'unauthenticated', user: null, error: null };
    case 'ERROR':
      return { ...state, status: 'unauthenticated', error: action.error };
    case 'UPDATE_USER':
      return { ...state, user: action.user };
    default:
      return state;
  }
}

interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const checkSession = async () => {
    try {
      const data = await apiClient.getSession();
      
      if (data.authenticated && data.user) {
        if (data.needsProfileSetup) {
          dispatch({ type: 'NEEDS_PROFILE_SETUP', user: data.user });
        } else {
          dispatch({ type: 'AUTHENTICATED', user: data.user });
        }
      } else {
        dispatch({ type: 'UNAUTHENTICATED' });
      }
    } catch (err) {
      dispatch({ type: 'UNAUTHENTICATED' });
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const logout = async () => {
    try {
      await apiClient.logout();
    } finally {
      dispatch({ type: 'UNAUTHENTICATED' });
    }
  };

  const refreshSession = async () => {
    dispatch({ type: 'LOADING' });
    await checkSession();
  };

  const updateUser = (user: AuthUser) => {
    dispatch({ type: 'UPDATE_USER', user });
    if (user.profileComplete && state.status === 'needs-profile-setup') {
      dispatch({ type: 'AUTHENTICATED', user });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        logout,
        refreshSession,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
