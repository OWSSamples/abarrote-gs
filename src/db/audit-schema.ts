import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userEmail: text('user_email').notNull(),
  action: text('action').notNull(), // create, update, delete, login, logout
  entity: text('entity').notNull(), // product, sale, cliente, etc
  entityId: text('entity_id').notNull(),
  changes: jsonb('changes'), // { before: {}, after: {} }
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});
