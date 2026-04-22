import type { Env, User, Medication, DailyRecord, PushSubscriptionData, UserSettings } from '../types';
import { addDays } from './date';

// デフォルト設定
export const DEFAULT_SETTINGS: UserSettings = {
  timings: {
    morning: '07:00',
    noon: '12:00',
    evening: '18:00',
    bedtime: '22:00'
  },
  reminderInterval: 15
};

// ユーザー関連
export async function getUser(kv: KVNamespace, uid: string): Promise<User | null> {
  const data = await kv.get(`users:${uid}`);
  return data ? JSON.parse(data) : null;
}

export async function saveUser(kv: KVNamespace, user: User): Promise<void> {
  await kv.put(`users:${user.uid}`, JSON.stringify(user));
}

export async function createUser(
  kv: KVNamespace,
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
  await kv.put(`users:${uid}`, JSON.stringify(user));
  return user;
}

export async function updateUserSettings(
  kv: KVNamespace,
  uid: string,
  settings: Partial<UserSettings>
): Promise<User | null> {
  const user = await getUser(kv, uid);
  if (!user) return null;

  user.settings = { ...user.settings, ...settings };
  await kv.put(`users:${uid}`, JSON.stringify(user));
  return user;
}

// 薬関連
export async function getMedications(kv: KVNamespace, uid: string): Promise<Medication[]> {
  const list = await kv.list({ prefix: `medications:${uid}:` });
  const medications: Medication[] = [];

  for (const key of list.keys) {
    const data = await kv.get(key.name);
    if (data) {
      medications.push(JSON.parse(data));
    }
  }

  return medications.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getMedication(
  kv: KVNamespace,
  uid: string,
  id: string
): Promise<Medication | null> {
  const data = await kv.get(`medications:${uid}:${id}`);
  return data ? JSON.parse(data) : null;
}

export async function saveMedication(
  kv: KVNamespace,
  uid: string,
  medication: Medication
): Promise<void> {
  await kv.put(`medications:${uid}:${medication.id}`, JSON.stringify(medication));
}

export async function deleteMedication(
  kv: KVNamespace,
  uid: string,
  id: string
): Promise<void> {
  await kv.delete(`medications:${uid}:${id}`);
}

// 服用記録関連
export async function getDailyRecord(
  kv: KVNamespace,
  uid: string,
  date: string
): Promise<DailyRecord | null> {
  const data = await kv.get(`records:${uid}:${date}`);
  return data ? JSON.parse(data) : null;
}

export async function saveDailyRecord(
  kv: KVNamespace,
  uid: string,
  record: DailyRecord
): Promise<void> {
  await kv.put(`records:${uid}:${record.date}`, JSON.stringify(record));
}

export async function getRecordsInRange(
  kv: KVNamespace,
  uid: string,
  fromDate: string,
  toDate: string
): Promise<DailyRecord[]> {
  const dates: string[] = [];
  let cursor = fromDate;
  while (cursor <= toDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const results = await Promise.all(
    dates.map(date => getDailyRecord(kv, uid, date))
  );

  return results.filter((r): r is DailyRecord => r !== null);
}

// WebPush購読関連
export async function getPushSubscription(
  kv: KVNamespace,
  uid: string
): Promise<PushSubscriptionData | null> {
  const data = await kv.get(`subscriptions:${uid}`);
  return data ? JSON.parse(data) : null;
}

export async function savePushSubscription(
  kv: KVNamespace,
  uid: string,
  subscription: PushSubscriptionData
): Promise<void> {
  await kv.put(`subscriptions:${uid}`, JSON.stringify(subscription));
}

export async function deletePushSubscription(
  kv: KVNamespace,
  uid: string
): Promise<void> {
  await kv.delete(`subscriptions:${uid}`);
}

// 全ユーザーの購読情報を取得（通知送信用）
export async function getAllSubscriptions(
  kv: KVNamespace
): Promise<Array<{ uid: string; subscription: PushSubscriptionData }>> {
  const list = await kv.list({ prefix: 'subscriptions:' });
  const result: Array<{ uid: string; subscription: PushSubscriptionData }> = [];

  for (const key of list.keys) {
    const data = await kv.get(key.name);
    if (data) {
      const uid = key.name.replace('subscriptions:', '');
      result.push({ uid, subscription: JSON.parse(data) });
    }
  }

  return result;
}

// 通知送信の冪等性フラグ
// key: notif:{uid}:{date}:{timing}:{windowStart}
// windowStart は cron ウィンドウ開始の分 (0,5,10,...,1435)
export async function hasNotificationBeenSent(
  kv: KVNamespace,
  uid: string,
  date: string,
  timing: string,
  windowStart: number
): Promise<boolean> {
  const key = `notif:${uid}:${date}:${timing}:${windowStart}`;
  const data = await kv.get(key);
  return data !== null;
}

export async function markNotificationSent(
  kv: KVNamespace,
  uid: string,
  date: string,
  timing: string,
  windowStart: number
): Promise<void> {
  const key = `notif:${uid}:${date}:${timing}:${windowStart}`;
  // ウィンドウ重複防止のための短期TTL (10分) で十分。翌日まで残す必要はない
  await kv.put(key, '1', { expirationTtl: 600 });
}

// スケジュールキャッシュ: 全ユーザーの通知時刻一覧
export async function getScheduleTimings(kv: KVNamespace): Promise<string[] | null> {
  const data = await kv.get('schedule:timings');
  return data ? JSON.parse(data) : null;
}

export async function saveScheduleTimings(kv: KVNamespace, timings: string[]): Promise<void> {
  await kv.put('schedule:timings', JSON.stringify(timings));
}

// 全ユーザー情報を取得（通知処理用）
export async function getAllUsers(kv: KVNamespace): Promise<User[]> {
  const list = await kv.list({ prefix: 'users:' });
  const users: User[] = [];

  for (const key of list.keys) {
    const data = await kv.get(key.name);
    if (data) {
      users.push(JSON.parse(data));
    }
  }

  return users;
}
