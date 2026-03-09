import type { OAuthProvider, AuthUser, OAuthConnection } from './auth.js';

export interface AdminUser extends AuthUser {
  connections: OAuthConnection[];
  sessionCount: number;
}

export interface OAuthApp {
  id: string;
  provider: OAuthProvider;
  clientId: string;
  scopes: string[];
  callbackUrl: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthAppUpdateRequest {
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  callbackUrl?: string;
  enabled?: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  eventType: string;
  provider: OAuthProvider | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type AuditEventType =
  | 'oauth_initiated'
  | 'oauth_callback_success'
  | 'oauth_callback_failure'
  | 'account_linked'
  | 'login'
  | 'logout'
  | 'token_refreshed'
  | 'token_replay_detected'
  | 'admin_credential_updated'
  | 'session_revoked_by_admin';

export interface AuthStats {
  totalUsers: number;
  activeSessions: number;
  loginsToday: number;
  loginsByProvider: Record<OAuthProvider, number>;
}
