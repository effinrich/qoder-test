import type { AuthUser } from '@oauth-service/shared-types';

const API_BASE = '/api';

interface ApiError {
  error: string;
}

class ApiClient {
  private refreshPromise: Promise<boolean> | null = null;

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry original request
        return this.request(path, options);
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = (await response.json()) as ApiError;
      throw new Error(error.error || 'Request failed');
    }

    return response.json() as Promise<T>;
  }

  private async refreshToken(): Promise<boolean> {
    // If refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        return response.ok;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async getSession(): Promise<{
    authenticated: boolean;
    user?: AuthUser;
    needsProfileSetup?: boolean;
  }> {
    return this.request('/auth/session');
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  async updateProfile(data: { name?: string; avatarUrl?: string }): Promise<{ user: AuthUser }> {
    return this.request('/user/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async completeProfile(name: string): Promise<{ user: AuthUser }> {
    return this.request('/user/me/complete-profile', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getConnections(): Promise<{
    connections: Array<{
      id: string;
      provider: string;
      providerUid: string;
      email: string | null;
      createdAt: string;
    }>;
  }> {
    return this.request('/user/me/connections');
  }

  async unlinkProvider(provider: string): Promise<void> {
    await this.request(`/user/me/connections/${provider}`, { method: 'DELETE' });
  }

  async getSessions(): Promise<{
    sessions: Array<{
      id: string;
      issuedAt: string;
      expiresAt: string;
      ipAddress: string;
      userAgent: string;
    }>;
  }> {
    return this.request('/session/list');
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.request(`/session/${sessionId}`, { method: 'DELETE' });
  }

  async revokeOtherSessions(): Promise<{ revokedCount: number }> {
    return this.request('/session/revoke-others', { method: 'POST' });
  }

  // Admin endpoints
  async getUsers(params: { page?: number; pageSize?: number; search?: string } = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params.search) searchParams.set('search', params.search);
    return this.request(`/admin/users?${searchParams}`);
  }

  async getUser(userId: string) {
    return this.request(`/admin/users/${userId}`);
  }

  async revokeUserSessions(userId: string): Promise<{ revokedCount: number }> {
    return this.request(`/admin/users/${userId}/revoke`, { method: 'POST' });
  }

  async getOAuthApps() {
    return this.request('/admin/oauth-apps');
  }

  async updateOAuthApp(
    provider: string,
    data: {
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
      callbackUrl?: string;
      enabled?: boolean;
    }
  ) {
    return this.request(`/admin/oauth-apps/${provider}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getAuditLog(params: {
    page?: number;
    pageSize?: number;
    eventType?: string;
    userId?: string;
  } = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params.eventType) searchParams.set('eventType', params.eventType);
    if (params.userId) searchParams.set('userId', params.userId);
    return this.request(`/admin/audit-log?${searchParams}`);
  }

  async getStats() {
    return this.request('/admin/stats');
  }
}

export const apiClient = new ApiClient();
