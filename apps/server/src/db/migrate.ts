import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Running database migrations...');

try {
  const migrationsFolder = path.resolve(__dirname, '..', '..', 'drizzle');
  migrate(db, { migrationsFolder });
  console.log('Database migrations completed successfully.');
} catch (error) {
  console.error('Database migrations failed:', error);
  process.exit(1);
} finally {
  sqlite.close();
}
