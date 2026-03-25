import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb, date, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Devices table
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  username: varchar('username', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('offline').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastSeenAt: timestamp('last_seen_at'),
  lastPingAt: timestamp('last_ping_at'),
  totalSent: integer('total_sent').default(0).notNull(),
  totalFailed: integer('total_failed').default(0).notNull(),
  priority: integer('priority').default(5).notNull(),
  // Health data from ping
  batteryLevel: integer('battery_level'),
  batteryCharging: boolean('battery_charging'),
  appVersion: varchar('app_version', { length: 50 }),
  connectionStatus: boolean('connection_status'),
  failedMessagesHour: integer('failed_messages_hour'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// SIM Cards table
export const simCards = pgTable('sim_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  simNumber: integer('sim_number').notNull(), // SIM slot: 1 or 2
  phoneNumber: varchar('phone_number', { length: 50 }),
  name: varchar('name', { length: 255 }),
  
  // Balance Management
  totalSmsLimit: integer('total_sms_limit').default(0).notNull(),
  smsUsed: integer('sms_used').default(0).notNull(),
  smsRemaining: integer('sms_remaining').default(0).notNull(),
  
  // Daily Limits
  dailySmsLimit: integer('daily_sms_limit').default(100).notNull(),
  dailySmsSent: integer('daily_sms_sent').default(0).notNull(),
  dailyResetAt: date('daily_reset_at'),
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  status: varchar('status', { length: 50 }).default('unknown').notNull(),
  
  // Stats
  totalSent: integer('total_sent').default(0).notNull(),
  totalDelivered: integer('total_delivered').default(0).notNull(),
  totalFailed: integer('total_failed').default(0).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueDeviceSim: uniqueIndex('unique_device_sim').on(table.deviceId, table.simNumber),
}));

// Messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 255 }),
  phoneNumbers: text('phone_numbers').array().notNull(),
  textContent: text('text_content').notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  priority: integer('priority').default(5).notNull(),
  
  // Device & SIM Assignment
  deviceId: varchar('device_id', { length: 255 }),
  simCardId: uuid('sim_card_id').references(() => simCards.id, { onDelete: 'set null' }),
  simNumber: integer('sim_number'),
  
  smsGateMessageId: varchar('sms_gate_message_id', { length: 255 }),
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  errorMessage: text('error_message'),
  failedReason: varchar('failed_reason', { length: 100 }),
  
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  failedAt: timestamp('failed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// SIM Usage Logs table
export const simUsageLogs = pgTable('sim_usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  simCardId: uuid('sim_card_id').notNull().references(() => simCards.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  smsSent: integer('sms_sent').default(0).notNull(),
  smsDelivered: integer('sms_delivered').default(0).notNull(),
  smsFailed: integer('sms_failed').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueSimDate: uniqueIndex('unique_sim_date').on(table.simCardId, table.date),
}));

// Registered Webhooks table (for managing device webhooks)
export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  webhookId: varchar('webhook_id', { length: 255 }).notNull(), // SMS-Gate webhook ID
  url: text('url').notNull(),
  event: varchar('event', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueDeviceWebhook: uniqueIndex('unique_device_webhook').on(table.deviceId, table.webhookId),
}));

// Webhook Logs table
export const webhookLogs = pgTable('webhook_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 255 }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  processed: boolean('processed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const devicesRelations = relations(devices, ({ many }) => ({
  simCards: many(simCards),
  webhooks: many(webhooks),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  device: one(devices, {
    fields: [webhooks.deviceId],
    references: [devices.id],
  }),
}));

export const simCardsRelations = relations(simCards, ({ one, many }) => ({
  device: one(devices, {
    fields: [simCards.deviceId],
    references: [devices.id],
  }),
  messages: many(messages),
  usageLogs: many(simUsageLogs),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  simCard: one(simCards, {
    fields: [messages.simCardId],
    references: [simCards.id],
  }),
}));

export const simUsageLogsRelations = relations(simUsageLogs, ({ one }) => ({
  simCard: one(simCards, {
    fields: [simUsageLogs.simCardId],
    references: [simCards.id],
  }),
}));

// Types
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;

export type SimCard = typeof simCards.$inferSelect;
export type NewSimCard = typeof simCards.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type SimUsageLog = typeof simUsageLogs.$inferSelect;
export type NewSimUsageLog = typeof simUsageLogs.$inferInsert;

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
