import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TokenPayload, AuthUser } from '@oauth-service/shared-types';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthUser;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const token = request.cookies.__access;
    if (!token) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const decoded = request.server.jwt.verify<TokenPayload>(token) as TokenPayload;
    
    const [user] = await request.server.db<AuthUser[]>`
      SELECT 
        id, email, email_verified as "emailVerified", name, 
        avatar_url as "avatarUrl", is_admin as "isAdmin",
        profile_complete as "profileComplete",
        created_at as "createdAt", last_login_at as "lastLoginAt"
      FROM users 
      WHERE id = ${decoded.userId}
    `;

    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    request.user = user;
  } catch {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authenticate(request, reply);
  
  if (reply.sent) return;
  
  if (!request.user?.isAdmin) {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}
