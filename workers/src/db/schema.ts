import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  uid: text('uid').primaryKey(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  morningTime: text('morning_time').notNull().default('07:00'),
  noonTime: text('noon_time').notNull().default('12:00'),
  eveningTime: text('evening_time').notNull().default('18:00'),
  bedtimeTime: text('bedtime_time').notNull().default('22:00'),
  reminderInterval: integer('reminder_interval').notNull().default(15),
  createdAt: text('created_at').notNull()
});

export const medications = sqliteTable(
  'medications',
  {
    id: text('id').primaryKey(),
    uid: text('uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    dosage: text('dosage').notNull(),
    timings: text('timings').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull()
  },
  table => ({
    uidIdx: index('idx_medications_uid').on(table.uid)
  })
);

export const records = sqliteTable(
  'records',
  {
    uid: text('uid').notNull(),
    date: text('date').notNull(),
    medicationId: text('medication_id').notNull(),
    timing: text('timing').notNull(),
    status: text('status').notNull(),
    recordedAt: text('recorded_at').notNull()
  },
  table => ({
    pk: primaryKey({ columns: [table.uid, table.date, table.medicationId, table.timing] }),
    uidDateIdx: index('idx_records_uid_date').on(table.uid, table.date)
  })
);

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  uid: text('uid')
    .primaryKey()
    .references(() => users.uid, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: text('created_at').notNull()
});

export const notificationLog = sqliteTable(
  'notification_log',
  {
    uid: text('uid').notNull(),
    date: text('date').notNull(),
    timing: text('timing').notNull(),
    windowStart: integer('window_start').notNull(),
    sentAt: text('sent_at').notNull()
  },
  table => ({
    pk: primaryKey({ columns: [table.uid, table.date, table.timing, table.windowStart] }),
    sentAtIdx: index('idx_notif_sent_at').on(table.sentAt)
  })
);
