import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import type { AuthUser, OAuthConnection, ProfileUpdateRequest } from '@oauth-service/shared-types';

export default async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // Get current user profile
  fastify.get('/me', { preHandler: authenticate }, async (request) => {
    return { user: request.user };
  });

  // Update profile
  fastify.put<{ Body: ProfileUpdateRequest }>(
    '/me',
    { preHandler: authenticate },
    async (request, reply) => {
      const { name, avatarUrl } = request.body;
      const userId = request.user!.id;

      const [updatedUser] = await fastify.db<AuthUser[]>`
        UPDATE users SET
          name = COALESCE(${name ?? null}, name),
          avatar_url = COALESCE(${avatarUrl ?? null}, avatar_url)
        WHERE id = ${userId}
        RETURNING 
          id, email, email_verified as "emailVerified", name, 
          avatar_url as "avatarUrl", is_admin as "isAdmin",
          profile_complete as "profileComplete",
          created_at as "createdAt", last_login_at as "lastLoginAt"
      `;

      return { user: updatedUser };
    }
  );

  // Complete profile setup
  fastify.post<{ Body: { name: string } }>(
    '/me/complete-profile',
    { preHandler: authenticate },
    async (request, reply) => {
      const { name } = request.body;
      const userId = request.user!.id;

      if (!name || name.trim().length === 0) {
        return reply.status(400).send({ error: 'Name is required' });
      }

      const [updatedUser] = await fastify.db<AuthUser[]>`
        UPDATE users SET
          name = ${name.trim()},
          profile_complete = true
        WHERE id = ${userId}
        RETURNING 
          id, email, email_verified as "emailVerified", name, 
          avatar_url as "avatarUrl", is_admin as "isAdmin",
          profile_complete as "profileComplete",
          created_at as "createdAt", last_login_at as "lastLoginAt"
      `;

      return { user: updatedUser };
    }
  );

  // Get linked OAuth connections
  fastify.get('/me/connections', { preHandler: authenticate }, async (request) => {
    const userId = request.user!.id;

    const connections = await fastify.db<OAuthConnection[]>`
      SELECT 
        id, provider, provider_uid as "providerUid", email,
        created_at as "createdAt"
      FROM oauth_connections
      WHERE user_id = ${userId}
      ORDER BY created_at ASC
    `;

    return { connections };
  });

  // Unlink OAuth provider
  fastify.delete<{ Params: { provider: string } }>(
    '/me/connections/:provider',
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = request.user!.id;
      const { provider } = request.params;

      // Check how many connections the user has
      const [countResult] = await fastify.db<{ count: string }[]>`
        SELECT COUNT(*) as count FROM oauth_connections WHERE user_id = ${userId}
      `;

      if (parseInt(countResult.count) <= 1) {
        return reply.status(400).send({
          error: 'Cannot unlink the only login method',
        });
      }

      // Delete the connection
      const result = await fastify.db`
        DELETE FROM oauth_connections
        WHERE user_id = ${userId} AND provider = ${provider}
        RETURNING id
      `;

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Connection not found' });
      }

      return { success: true };
    }
  );
}
