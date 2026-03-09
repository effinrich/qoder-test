export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LoginInitResponse {
  redirectUrl: string;
}

export interface SessionResponse {
  user: import('./auth.js').AuthUser;
}

export interface ProfileUpdateRequest {
  name?: string;
  avatarUrl?: string;
}

export interface ProfileSetupRequest {
  name: string;
}
