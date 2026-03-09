import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { config, type Config } from '../config/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

export default fp(async function configPlugin(fastify: FastifyInstance) {
  fastify.decorate('config', config);
}, {
  name: 'config',
});
