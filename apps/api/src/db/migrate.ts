import { sql } from './index.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate(): Promise<void> {
  console.log('Running database migrations...');

  // Create migrations tracking table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Get list of executed migrations
  const executed = await sql<{ name: string }[]>`
    SELECT name FROM _migrations ORDER BY id
  `;
  const executedNames = new Set(executed.map((m) => m.name));

  // Run pending migrations
  const migrations = ['001_initial_schema.sql'];

  for (const migration of migrations) {
    if (executedNames.has(migration)) {
      console.log(`  Skipping ${migration} (already executed)`);
      continue;
    }

    console.log(`  Running ${migration}...`);
    const filePath = join(__dirname, '..', '..', 'migrations', migration);
    const content = await readFile(filePath, 'utf-8');

    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO _migrations (name) VALUES (${migration})`;
    });

    console.log(`  Completed ${migration}`);
  }

  console.log('Migrations complete!');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
