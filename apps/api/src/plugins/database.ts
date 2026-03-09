import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { sql, closeDatabase } from '../db/index.js';
import type { Row, RowList } from 'postgres';

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof sql;
  }
}

export default fp(async function databasePlugin(fastify: FastifyInstance) {
  fastify.decorate('db', sql);

  fastify.addHook('onClose', async () => {
    await closeDatabase();
  });
}, {
  name: 'database',
  dependencies: ['config'],
});
