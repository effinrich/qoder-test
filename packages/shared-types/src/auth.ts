export type OAuthProvider = 'google' | 'github';

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  profileComplete: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface OAuthConnection {
  id: string;
  provider: OAuthProvider;
  providerUid: string;
  email: string | null;
  createdAt: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
  iat: number;
  exp: number;
}

export type SessionStatus = 
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'needs-profile-setup';

export interface SessionState {
  status: SessionStatus;
  user: AuthUser | null;
  error: string | null;
}
