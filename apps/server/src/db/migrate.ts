import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './index.js';
import path from 'path';

console.log('Running database migrations...');

try {
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  console.log('Database migrations completed successfully.');
} catch (error) {
  console.error('Database migrations failed:', error);
  process.exit(1);
} finally {
  sqlite.close();
}
