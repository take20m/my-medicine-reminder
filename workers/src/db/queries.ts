import { and, eq, gte, lte, or, sql } from 'drizzle-orm';
import type { Database } from './client';
import * as schema from './schema';
import type {
  User,
  UserSettings,
  Medication,
  DailyRecord,
  RecordEntry,
  TimingType,
  PushSubscriptionData
} from '../types';

export const DEFAULT_SETTINGS: UserSettings = {
  timings: {
    morning: '07:00',
    noon: '12:00',
    evening: '18:00',
    bedtime: '22:00'
  },
  reminderInterval: 15
};

type UserRow = typeof schema.users.$inferSelect;
type MedicationRow = typeof schema.medications.$inferSelect;
type RecordRow = typeof schema.records.$inferSelect;
type PushSubscriptionRow = typeof schema.pushSubscriptions.$inferSelect;

function rowToUser(row: UserRow): User {
  return {
    uid: row.uid,
    displayName: row.displayName,
    email: row.email,
    settings: {
      timings: {
        morning: row.morningTime,
        noon: row.noonTime,
        evening: row.eveningTime,
        bedtime: row.bedtimeTime
      },
      reminderInterval: row.reminderInterval
    },
    createdAt: row.createdAt
  };
}

function rowToMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    dosage: row.dosage,
    timings: JSON.parse(row.timings) as TimingType[],
    active: row.active,
    createdAt: row.createdAt
  };
}

function rowToPushSubscription(row: PushSubscriptionRow): PushSubscriptionData {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth
    },
    createdAt: row.createdAt
  };
}

// ---------- ユーザー ----------
export async function getUser(db: Database, uid: string): Promise<User | null> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.uid, uid)).limit(1);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function upsertUser(db: Database, user: User): Promise<void> {
  await db
    .insert(schema.users)
    .values({
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      morningTime: user.settings.timings.morning,
      noonTime: user.settings.timings.noon,
      eveningTime: user.settings.timings.evening,
      bedtimeTime: user.settings.timings.bedtime,
      reminderInterval: user.settings.reminderInterval,
      createdAt: user.createdAt
    })
    .onConflictDoUpdate({
      target: schema.users.uid,
      set: {
        displayName: user.displayName,
        email: user.email,
        morningTime: user.settings.timings.morning,
        noonTime: user.settings.timings.noon,
        eveningTime: user.settings.timings.evening,
        bedtimeTime: user.settings.timings.bedtime,
        reminderInterval: user.settings.reminderInterval
      }
    });
}

export async function createUser(
  db: Database,
  uid: string,
  displayName: string,
  email: string
): Promise<User> {
  const user: User = {
    uid,
    displayName,
    email,
    settings: DEFAULT_SETTINGS,
    createdAt: new Date().toISOString()
  };
  await db.insert(schema.users).values({
    uid,
    displayName,
    email,
    morningTime: DEFAULT_SETTINGS.timings.morning,
    noonTime: DEFAULT_SETTINGS.timings.noon,
    eveningTime: DEFAULT_SETTINGS.timings.evening,
    bedtimeTime: DEFAULT_SETTINGS.timings.bedtime,
    reminderInterval: DEFAULT_SETTINGS.reminderInterval,
    createdAt: user.createdAt
  });
  return user;
}

export async function updateUserSettings(
  db: Database,
  uid: string,
  settings: Partial<UserSettings>
): Promise<User | null> {
  const current = await getUser(db, uid);
  if (!current) return null;

  const merged: UserSettings = {
    timings: { ...current.settings.timings, ...(settings.timings ?? {}) },
    reminderInterval: settings.reminderInterval ?? current.settings.reminderInterval
  };

  await db
    .update(schema.users)
    .set({
      morningTime: merged.timings.morning,
      noonTime: merged.timings.noon,
      eveningTime: merged.timings.evening,
      bedtimeTime: merged.timings.bedtime,
      reminderInterval: merged.reminderInterval
    })
    .where(eq(schema.users.uid, uid));

  return { ...current, settings: merged };
}

export async function getAllUsers(db: Database): Promise<User[]> {
  const rows = await db.select().from(schema.users);
  return rows.map(rowToUser);
}

// ---------- 薬 ----------
export async function getMedications(db: Database, uid: string): Promise<Medication[]> {
  const rows = await db
    .select()
    .from(schema.medications)
    .where(eq(schema.medications.uid, uid));
  return rows.map(rowToMedication).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getMedication(
  db: Database,
  uid: string,
  id: string
): Promise<Medication | null> {
  const rows = await db
    .select()
    .from(schema.medications)
    .where(and(eq(schema.medications.uid, uid), eq(schema.medications.id, id)))
    .limit(1);
  return rows[0] ? rowToMedication(rows[0]) : null;
}

export async function saveMedication(
  db: Database,
  uid: string,
  medication: Medication
): Promise<void> {
  await db
    .insert(schema.medications)
    .values({
      id: medication.id,
      uid,
      name: medication.name,
      description: medication.description,
      dosage: medication.dosage,
      timings: JSON.stringify(medication.timings),
      active: medication.active,
      createdAt: medication.createdAt
    })
    .onConflictDoUpdate({
      target: schema.medications.id,
      set: {
        name: medication.name,
        description: medication.description,
        dosage: medication.dosage,
        timings: JSON.stringify(medication.timings),
        active: medication.active
      }
    });
}

export async function deleteMedication(
  db: Database,
  uid: string,
  id: string
): Promise<void> {
  await db
    .delete(schema.medications)
    .where(and(eq(schema.medications.uid, uid), eq(schema.medications.id, id)));
}

// ---------- 服用記録 ----------
function rowsToDailyRecord(uid: string, date: string, rows: RecordRow[]): DailyRecord | null {
  if (rows.length === 0) return null;
  const entries: RecordEntry[] = rows.map(r => ({
    medicationId: r.medicationId,
    timing: r.timing as TimingType,
    status: r.status as RecordEntry['status'],
    recordedAt: r.recordedAt
  }));
  return { date, entries };
}

export async function getDailyRecord(
  db: Database,
  uid: string,
  date: string
): Promise<DailyRecord | null> {
  const rows = await db
    .select()
    .from(schema.records)
    .where(and(eq(schema.records.uid, uid), eq(schema.records.date, date)));
  return rowsToDailyRecord(uid, date, rows);
}

export async function saveDailyRecord(
  db: Database,
  uid: string,
  record: DailyRecord
): Promise<void> {
  if (record.entries.length === 0) {
    await db
      .delete(schema.records)
      .where(and(eq(schema.records.uid, uid), eq(schema.records.date, record.date)));
    return;
  }

  // upsert: 既存の (uid, date) のエントリを削除してから挿入 (batch でアトミックに実行)
  await db.batch([
    db
      .delete(schema.records)
      .where(and(eq(schema.records.uid, uid), eq(schema.records.date, record.date))),
    db.insert(schema.records).values(
      record.entries.map(e => ({
        uid,
        date: record.date,
        medicationId: e.medicationId,
        timing: e.timing,
        status: e.status,
        recordedAt: e.recordedAt
      }))
    )
  ]);
}

export async function getRecordsInRange(
  db: Database,
  uid: string,
  fromDate: string,
  toDate: string
): Promise<DailyRecord[]> {
  const rows = await db
    .select()
    .from(schema.records)
    .where(
      and(
        eq(schema.records.uid, uid),
        gte(schema.records.date, fromDate),
        lte(schema.records.date, toDate)
      )
    );

  const byDate = new Map<string, RecordRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  const result: DailyRecord[] = [];
  for (const [date, dayRows] of byDate) {
    const r = rowsToDailyRecord(uid, date, dayRows);
    if (r) result.push(r);
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- WebPush 購読 ----------
export async function getPushSubscription(
  db: Database,
  uid: string
): Promise<PushSubscriptionData | null> {
  const rows = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.uid, uid))
    .limit(1);
  return rows[0] ? rowToPushSubscription(rows[0]) : null;
}

export async function savePushSubscription(
  db: Database,
  uid: string,
  subscription: PushSubscriptionData
): Promise<void> {
  await db
    .insert(schema.pushSubscriptions)
    .values({
      uid,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      createdAt: subscription.createdAt
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.uid,
      set: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        createdAt: subscription.createdAt
      }
    });
}

export async function deletePushSubscription(db: Database, uid: string): Promise<void> {
  await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.uid, uid));
}

export async function getAllSubscriptions(
  db: Database
): Promise<Array<{ uid: string; subscription: PushSubscriptionData }>> {
  const rows = await db.select().from(schema.pushSubscriptions);
  return rows.map(row => ({
    uid: row.uid,
    subscription: rowToPushSubscription(row)
  }));
}

// ---------- 通知冪等性ログ ----------
export async function hasNotificationBeenSent(
  db: Database,
  uid: string,
  date: string,
  timing: string,
  windowStart: number
): Promise<boolean> {
  const rows = await db
    .select({ uid: schema.notificationLog.uid })
    .from(schema.notificationLog)
    .where(
      and(
        eq(schema.notificationLog.uid, uid),
        eq(schema.notificationLog.date, date),
        eq(schema.notificationLog.timing, timing),
        eq(schema.notificationLog.windowStart, windowStart)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function markNotificationSent(
  db: Database,
  uid: string,
  date: string,
  timing: string,
  windowStart: number
): Promise<void> {
  await db
    .insert(schema.notificationLog)
    .values({
      uid,
      date,
      timing,
      windowStart,
      sentAt: new Date().toISOString()
    })
    .onConflictDoNothing();
}

// 古い notification_log を掃除 (cron 末尾で呼ぶ。TTL 10分相当)
export async function purgeOldNotificationLogs(db: Database): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await db.delete(schema.notificationLog).where(lte(schema.notificationLog.sentAt, tenMinutesAgo));
}

// ---------- scheduler 用: 該当時刻のユーザーを直接抽出 ----------
/**
 * 指定された複数の時刻 (HH:MM 文字列) のいずれかをタイミングに設定しているユーザーを返す。
 * KV 時代の schedule:uids:* インデックスの代替。SQL の WHERE で直接抽出できるので
 * インデックスキャッシュは不要になった。
 */
export async function getUsersByTimings(db: Database, times: string[]): Promise<User[]> {
  if (times.length === 0) return [];
  // inArray だと times の要素数 × 4 カラム分のバインド変数を消費し、候補時刻 65 個で
  // D1 の上限 (100 変数/クエリ) を超える。json_each で JSON 文字列 1 個のバインドに抑える。
  const timesJson = JSON.stringify(times);
  const rows = await db
    .select()
    .from(schema.users)
    .where(
      or(
        sql`${schema.users.morningTime} IN (SELECT value FROM json_each(${timesJson}))`,
        sql`${schema.users.noonTime} IN (SELECT value FROM json_each(${timesJson}))`,
        sql`${schema.users.eveningTime} IN (SELECT value FROM json_each(${timesJson}))`,
        sql`${schema.users.bedtimeTime} IN (SELECT value FROM json_each(${timesJson}))`
      )
    );
  return rows.map(rowToUser);
}

// 互換ヘルパー: 1ユーザーの timing 一覧を取り出す (medications などで利用)
export function userTimingsArray(user: User): string[] {
  return [
    user.settings.timings.morning,
    user.settings.timings.noon,
    user.settings.timings.evening,
    user.settings.timings.bedtime
  ];
}
