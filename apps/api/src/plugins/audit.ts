import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuditEventType, OAuthProvider } from '@oauth-service/shared-types';

interface AuditLogData {
  userId?: string | null;
  eventType: AuditEventType;
  provider?: OAuthProvider | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

interface AuditService {
  log(data: AuditLogData): void;
  logFromRequest(request: FastifyRequest, data: Omit<AuditLogData, 'ipAddress' | 'userAgent'>): void;
}

declare module 'fastify' {
  interface FastifyInstance {
    audit: AuditService;
  }
}

export default fp(async function auditPlugin(fastify: FastifyInstance) {
  const audit: AuditService = {
    log(data: AuditLogData): void {
      // Fire and forget - don't await
      fastify.db`
        INSERT INTO audit_log (user_id, event_type, provider, ip_address, user_agent, metadata)
        VALUES (
          ${data.userId ?? null},
          ${data.eventType},
          ${data.provider ?? null},
          ${data.ipAddress ?? null},
          ${data.userAgent ?? null},
          ${JSON.stringify(data.metadata ?? {})}::jsonb
        )
      `.catch((err) => {
        fastify.log.error({ err, data }, 'Failed to write audit log');
      });
    },

    logFromRequest(request: FastifyRequest, data: Omit<AuditLogData, 'ipAddress' | 'userAgent'>): void {
      this.log({
        ...data,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
    },
  };

  fastify.decorate('audit', audit);
}, {
  name: 'audit',
  dependencies: ['database'],
});
