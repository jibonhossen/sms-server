import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  DATABASE_URL: z.string().default('postgresql://sms_gateway:sms_gateway_password@localhost:5432/sms_gateway'),
  
  // SMS-Gate
  SMS_GATE_CLOUD_URL: z.string().default('https://api.sms-gate.app/3rdparty/v1'),
  
  // Security
  API_KEY_SECRET: z.string().default('your-secret-key-change-in-production'),
  WEBHOOK_SECRET: z.string().default('webhook-secret-change-in-production'),
  
  // Queue
  QUEUE_PROCESS_INTERVAL_MS: z.string().default('1000').transform(Number),
  MAX_RETRY_ATTEMPTS: z.string().default('3').transform(Number),
  RETRY_DELAY_MS: z.string().default('60000').transform(Number),
  
  // Health Check (Bun Cron)
  HEALTH_CHECK_CRON: z.string().default('*/5 * * * *'),
  DAILY_RESET_CRON: z.string().default('0 0 * * *'),
  DEVICE_OFFLINE_THRESHOLD_MS: z.string().default('600000').transform(Number),
  
  // SIM Defaults
  DEFAULT_DAILY_SMS_LIMIT: z.string().default('100').transform(Number),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
