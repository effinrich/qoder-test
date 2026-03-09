import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';

import configPlugin from './plugins/config.js';
import databasePlugin from './plugins/database.js';
import encryptionPlugin from './plugins/encryption.js';
import auditPlugin from './plugins/audit.js';

import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/user/routes.js';
import sessionRoutes from './modules/session/routes.js';
import adminRoutes from './modules/admin/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,
  });

  // Register plugins in order
  await app.register(configPlugin);
  await app.register(databasePlugin);
  await app.register(encryptionPlugin);
  await app.register(auditPlugin);

  // Cookie support
  await app.register(fastifyCookie, {
    secret: app.config.cookie.secret,
    parseOptions: {},
  });

  // CORS
  await app.register(fastifyCors, {
    origin: app.config.urls.web,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Security headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: app.config.isProduction,
  });

  // JWT
  await app.register(fastifyJwt, {
    secret: app.config.jwt.secret,
    cookie: {
      cookieName: '__access',
      signed: false,
    },
  });

  // Rate limiting
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(userRoutes, { prefix: '/user' });
  await app.register(sessionRoutes, { prefix: '/session' });
  await app.register(adminRoutes, { prefix: '/admin' });

  return app;
}
