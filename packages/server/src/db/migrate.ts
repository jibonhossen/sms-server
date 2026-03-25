import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, migrationClient } from './index';

async function runMigrations() {
  console.log('Running migrations...');
  
  await migrate(db, {
    migrationsFolder: './src/db/migrations',
  });
  
  console.log('Migrations completed successfully!');
  
  await migrationClient.end();
  process.exit(0);
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
