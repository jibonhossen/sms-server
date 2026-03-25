import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://sms_gateway:sms_gateway_password@localhost:5432/sms_gateway';

// For migrations
export const migrationClient = postgres(connectionString, { max: 1 });

// For queries
const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });

export { schema };
