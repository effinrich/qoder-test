import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/auth.js';
import type {
  AdminUser,
  OAuthApp,
  AuditLogEntry,
  AuthStats,
  PaginatedResponse,
} from '@oauth-service/shared-types';

export default async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // All admin routes require admin access
  fastify.addHook('preHandler', requireAdmin);

  // Get paginated users list
  fastify.get<{
    Querystring: { page?: string; pageSize?: string; search?: string };
  }>('/users', async (request) => {
    const page = parseInt(request.query.page ?? '1');
    const pageSize = Math.min(parseInt(request.query.pageSize ?? '20'), 100);
    const offset = (page - 1) * pageSize;
    const search = request.query.search ?? '';

    let users;
    let totalResult;

    if (search) {
      users = await fastify.db`
        SELECT 
          id, email, email_verified as "emailVerified", name, 
          avatar_url as "avatarUrl", is_admin as "isAdmin",
          profile_complete as "profileComplete",
          created_at as "createdAt", last_login_at as "lastLoginAt"
        FROM users
        WHERE email ILIKE ${'%' + search + '%'} OR name ILIKE ${'%' + search + '%'}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      totalResult = await fastify.db`
        SELECT COUNT(*) as count FROM users
        WHERE email ILIKE ${'%' + search + '%'} OR name ILIKE ${'%' + search + '%'}
      `;
    } else {
      users = await fastify.db`
        SELECT 
          id, email, email_verified as "emailVerified", name, 
          avatar_url as "avatarUrl", is_admin as "isAdmin",
          profile_complete as "profileComplete",
          created_at as "createdAt", last_login_at as "lastLoginAt"
        FROM users
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      totalResult = await fastify.db`SELECT COUNT(*) as count FROM users`;
    }

    const total = parseInt(totalResult[0].count);

    return {
      items: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    } as PaginatedResponse<AdminUser>;
  });

  // Get user detail
  fastify.get<{ Params: { userId: string } }>('/users/:userId', async (request, reply) => {
    const { userId } = request.params;

    const [user] = await fastify.db`
      SELECT 
        id, email, email_verified as "emailVerified", name, 
        avatar_url as "avatarUrl", is_admin as "isAdmin",
        profile_complete as "profileComplete",
        created_at as "createdAt", last_login_at as "lastLoginAt"
      FROM users WHERE id = ${userId}
    `;

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const connections = await fastify.db`
      SELECT provider, provider_uid as "providerUid", email, created_at as "createdAt"
      FROM oauth_connections WHERE user_id = ${userId}
    `;

    const [sessionCount] = await fastify.db`
      SELECT COUNT(*) as count FROM sessions 
      WHERE user_id = ${userId} AND revoked_at IS NULL AND expires_at > NOW()
    `;

    return {
      ...user,
      connections,
      sessionCount: parseInt(sessionCount.count),
    };
  });

  // Revoke all sessions for a user
  fastify.post<{ Params: { userId: string } }>(
    '/users/:userId/revoke',
    async (request, reply) => {
      const { userId } = request.params;
      const adminId = request.user!.id;

      const result = await fastify.db`
        UPDATE sessions SET revoked_at = NOW()
        WHERE user_id = ${userId} AND revoked_at IS NULL
        RETURNING id
      `;

      fastify.audit.logFromRequest(request, {
        userId: adminId,
        eventType: 'session_revoked_by_admin',
        metadata: { targetUserId: userId, revokedCount: result.length },
      });

      return { revokedCount: result.length };
    }
  );

  // List OAuth apps
  fastify.get('/oauth-apps', async () => {
    const apps = await fastify.db`
      SELECT 
        id, provider, client_id as "clientId", scopes, 
        callback_url as "callbackUrl", enabled,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM oauth_apps
      ORDER BY provider ASC
    `;

    return { apps };
  });

  // Update OAuth app
  fastify.put<{
    Params: { provider: string };
    Body: {
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
      callbackUrl?: string;
      enabled?: boolean;
    };
  }>('/oauth-apps/:provider', async (request, reply) => {
    const { provider } = request.params;
    const { clientId, clientSecret, scopes, callbackUrl, enabled } = request.body;
    const adminId = request.user!.id;

    // Build update query dynamically
    const updates: Record<string, unknown> = {};
    if (clientId !== undefined) updates.client_id = clientId;
    if (clientSecret !== undefined) {
      updates.client_secret = fastify.encryption.encrypt(clientSecret);
    }
    if (scopes !== undefined) updates.scopes = scopes;
    if (callbackUrl !== undefined) updates.callback_url = callbackUrl;
    if (enabled !== undefined) updates.enabled = enabled;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: 'No updates provided' });
    }

    const [updated] = await fastify.db`
      UPDATE oauth_apps SET
        client_id = COALESCE(${updates.client_id ?? null}, client_id),
        client_secret = COALESCE(${updates.client_secret ?? null}, client_secret),
        scopes = COALESCE(${updates.scopes ?? null}, scopes),
        callback_url = COALESCE(${updates.callback_url ?? null}, callback_url),
        enabled = COALESCE(${updates.enabled ?? null}, enabled)
      WHERE provider = ${provider}
      RETURNING 
        id, provider, client_id as "clientId", scopes, 
        callback_url as "callbackUrl", enabled,
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    if (!updated) {
      return reply.status(404).send({ error: 'OAuth app not found' });
    }

    fastify.audit.logFromRequest(request, {
      userId: adminId,
      eventType: 'admin_credential_updated',
      provider: provider as 'google' | 'github',
      metadata: { updatedFields: Object.keys(updates) },
    });

    return { app: updated };
  });

  // Get audit log
  fastify.get<{
    Querystring: {
      page?: string;
      pageSize?: string;
      eventType?: string;
      userId?: string;
    };
  }>('/audit-log', async (request) => {
    const page = parseInt(request.query.page ?? '1');
    const pageSize = Math.min(parseInt(request.query.pageSize ?? '50'), 100);
    const offset = (page - 1) * pageSize;
    const eventType = request.query.eventType;
    const userId = request.query.userId;

    let entries;
    let totalResult;

    if (eventType && userId) {
      entries = await fastify.db<AuditLogEntry[]>`
        SELECT 
          id, user_id as "userId", event_type as "eventType", provider,
          ip_address as "ipAddress", user_agent as "userAgent", metadata,
          created_at as "createdAt"
        FROM audit_log
        WHERE event_type = ${eventType} AND user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      totalResult = await fastify.db`
        SELECT COUNT(*) as count FROM audit_log
        WHERE event_type = ${eventType} AND user_id = ${userId}
      `;
    } else if (eventType) {
      entries = await fastify.db<AuditLogEntry[]>`
        SELECT 
          id, user_id as "userId", event_type as "eventType", provider,
          ip_address as "ipAddress", user_agent as "userAgent", metadata,
          created_at as "createdAt"
        FROM audit_log
        WHERE event_type = ${eventType}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      totalResult = await fastify.db`
        SELECT COUNT(*) as count FROM audit_log WHERE event_type = ${eventType}
      `;
    } else if (userId) {
      entries = await fastify.db<AuditLogEntry[]>`
        SELECT 
          id, user_id as "userId", event_type as "eventType", provider,
          ip_address as "ipAddress", user_agent as "userAgent", metadata,
          created_at as "createdAt"
        FROM audit_log
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      totalResult = await fastify.db`
        SELECT COUNT(*) as count FROM audit_log WHERE user_id = ${userId}
      `;
    } else {
      entries = await fastify.db<AuditLogEntry[]>`
        SELECT 
          id, user_id as "userId", event_type as "eventType", provider,
          ip_address as "ipAddress", user_agent as "userAgent", metadata,
          created_at as "createdAt"
        FROM audit_log
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      totalResult = await fastify.db`SELECT COUNT(*) as count FROM audit_log`;
    }

    const total = parseInt(totalResult[0].count);

    return {
      items: entries,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  });

  // Get stats
  fastify.get('/stats', async (): Promise<AuthStats> => {
    const [usersResult] = await fastify.db`SELECT COUNT(*) as count FROM users`;
    const [sessionsResult] = await fastify.db`
      SELECT COUNT(*) as count FROM sessions 
      WHERE revoked_at IS NULL AND expires_at > NOW()
    `;
    const [loginsResult] = await fastify.db`
      SELECT COUNT(*) as count FROM audit_log 
      WHERE event_type = 'login' AND created_at > NOW() - INTERVAL '24 hours'
    `;

    const providerCounts = await fastify.db`
      SELECT provider, COUNT(*) as count
      FROM oauth_connections
      GROUP BY provider
    `;

    const loginsByProvider: Record<string, number> = {};
    for (const row of providerCounts) {
      loginsByProvider[row.provider] = parseInt(row.count);
    }

    return {
      totalUsers: parseInt(usersResult.count),
      activeSessions: parseInt(sessionsResult.count),
      loginsToday: parseInt(loginsResult.count),
      loginsByProvider: loginsByProvider as Record<'google' | 'github', number>,
    };
  });
}
