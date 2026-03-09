import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';

export default async function sessionRoutes(fastify: FastifyInstance): Promise<void> {
  // Get active sessions for current user
  fastify.get('/list', { preHandler: authenticate }, async (request) => {
    const userId = request.user!.id;

    const sessions = await fastify.db`
      SELECT 
        id, issued_at as "issuedAt", expires_at as "expiresAt",
        ip_address as "ipAddress", user_agent as "userAgent"
      FROM sessions
      WHERE user_id = ${userId} 
        AND revoked_at IS NULL 
        AND expires_at > NOW()
      ORDER BY issued_at DESC
    `;

    return { sessions };
  });

  // Revoke a specific session
  fastify.delete<{ Params: { sessionId: string } }>(
    '/:sessionId',
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = request.user!.id;
      const { sessionId } = request.params;

      const result = await fastify.db`
        UPDATE sessions SET revoked_at = NOW()
        WHERE id = ${sessionId} AND user_id = ${userId} AND revoked_at IS NULL
        RETURNING id
      `;

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      return { success: true };
    }
  );

  // Revoke all other sessions (keep current one)
  fastify.post('/revoke-others', { preHandler: authenticate }, async (request) => {
    const userId = request.user!.id;
    const currentRefreshToken = request.cookies.__refresh;

    if (!currentRefreshToken) {
      return { revokedCount: 0 };
    }

    const crypto = await import('node:crypto');
    const currentHash = crypto.createHash('sha256').update(currentRefreshToken).digest('hex');

    const result = await fastify.db`
      UPDATE sessions SET revoked_at = NOW()
      WHERE user_id = ${userId} 
        AND refresh_token_hash != ${currentHash}
        AND revoked_at IS NULL
      RETURNING id
    `;

    return { revokedCount: result.length };
  });
}
