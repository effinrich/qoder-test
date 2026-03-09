import postgres from 'postgres';
import { config } from '../config/index.js';

export const sql = postgres(config.database.url, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  transform: {
    undefined: null,
  },
});

export async function closeDatabase(): Promise<void> {
  await sql.end();
}
