import type { Env, TimingType, User, Medication } from '../types';
import { createDb, type Database } from '../db/client';
import {
  getPushSubscription,
  getMedications,
  getDailyRecord,
  getUsersByTimings,
  hasNotificationBeenSent,
  markNotificationSent,
  purgeOldNotificationLogs
} from '../db/queries';
import { sendPushNotification } from '../utils/webpush';
import { getJstDateTimeParts } from '../utils/date';
import { MAX_MAX_REMINDER_COUNT, TIMING_LABELS } from '../types';

// 時刻文字列 (HH:MM) を分に変換
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// 分を HH:MM 形式に
function minutesToTime(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// 指定タイミングで未服用の薬があるかチェック
async function hasUnrecordedMedications(
  db: Database,
  uid: string,
  timing: TimingType,
  date: string
): Promise<Medication[]> {
  const medications = await getMedications(db, uid);
  const record = await getDailyRecord(db, uid, date);

  const medicationsForTiming = medications.filter(
    med => med.active && med.timings.includes(timing)
  );

  if (!record) {
    return medicationsForTiming;
  }

  return medicationsForTiming.filter(med => {
    const entry = record.entries.find(
      e => e.medicationId === med.id && e.timing === timing
    );
    return !entry || entry.status === 'pending';
  });
}

async function sendReminderToUser(
  env: Env,
  db: Database,
  user: User,
  timing: TimingType,
  medications: Medication[]
): Promise<void> {
  const subscription = await getPushSubscription(db, user.uid);

  if (!subscription) {
    console.log(`No subscription for user ${user.uid}`);
    return;
  }

  const medicationNames = medications.map(m => m.name).join('、');
  const timingLabel = TIMING_LABELS[timing];

  try {
    await sendPushNotification(env, subscription, {
      title: `${timingLabel}のお薬の時間です`,
      body: `${medicationNames}を服用してください`,
      tag: `reminder-${timing}`,
      data: {
        type: 'reminder',
        timing,
        medicationIds: medications.map(m => m.id),
        timestamp: new Date().toISOString()
      }
    });
    console.log(`Sent reminder to ${user.uid} for ${timing}`);
  } catch (error) {
    console.error(`Failed to send reminder to ${user.uid}:`, error);
  }
}

// cron間隔（分）。wrangler.toml の crons = ["*/5 * * * *"] と一致させる
export const CRON_INTERVAL = 5;

// 再通知間隔の最大値（分）。settings ルートの検証と一致させる
const MAX_REMINDER_INTERVAL = 60;

export function isInCurrentWindow(targetMinutes: number, currentMinutes: number): boolean {
  const windowStart = currentMinutes - CRON_INTERVAL + 1;
  return targetMinutes >= windowStart && targetMinutes <= currentMinutes;
}

/**
 * 設定時刻から何分後まで通知しうるか。
 * 再通知は「間隔 × 最大回数」で打ち切るが、初回通知だけは最大回数 0 でも飛ぶので
 * 最低でも cron ウィンドウ 1 回分は見る。
 */
export function maxElapsedMinutes(reminderInterval: number, maxReminderCount: number): number {
  return Math.max(reminderInterval * maxReminderCount, CRON_INTERVAL);
}

/**
 * この cron ウィンドウが n 回目の再通知に当たるか。
 * cron は5分毎なので、ウィンドウ内の各分が再通知間隔の倍数かを見る。
 * 倍数であっても、それが最大回数を超えていれば送らない。
 */
export function isReminderWindow(
  diffMinutes: number,
  reminderInterval: number,
  maxReminderCount: number
): boolean {
  if (diffMinutes <= 0) return false;
  for (let d = diffMinutes - CRON_INTERVAL + 1; d <= diffMinutes; d++) {
    if (d > 0 && d % reminderInterval === 0 && d / reminderInterval <= maxReminderCount) {
      return true;
    }
  }
  return false;
}

/**
 * この cron ウィンドウで通知を送るべきか（初回通知 or 再通知）。
 * 日をまたいだ場合 (diffMinutes < 0) は回数が残っていても打ち切る。
 * 服薬記録が日付単位なので、翌日に前日分の通知を送らない。
 */
export function shouldSendNotification(params: {
  currentMinutes: number;
  targetMinutes: number;
  reminderInterval: number;
  maxReminderCount: number;
}): boolean {
  const { currentMinutes, targetMinutes, reminderInterval, maxReminderCount } = params;
  const diffMinutes = currentMinutes - targetMinutes;

  if (diffMinutes < 0) return false;
  if (diffMinutes > maxElapsedMinutes(reminderInterval, maxReminderCount)) return false;

  return (
    isInCurrentWindow(targetMinutes, currentMinutes) ||
    isReminderWindow(diffMinutes, reminderInterval, maxReminderCount)
  );
}

/**
 * 現在のウィンドウ + 再通知が飛びうる過去の範囲を分単位で HH:MM 配列に展開。
 * SQL の WHERE 句で「ユーザーの設定時刻のいずれかがこの一覧に含まれる」と絞り込むのに使う。
 * 最大値はユーザーが設定しうる上限 (60分 × 10回) + cron ウィンドウ 1 回分。
 * 日をまたいだら打ち切るので、当日 00:00 より前は展開しない。
 */
export function relevantTimesForWindow(currentMinutes: number): string[] {
  const maxLookback = Math.min(
    MAX_REMINDER_INTERVAL * MAX_MAX_REMINDER_COUNT + CRON_INTERVAL,
    currentMinutes + 1
  );
  const times: string[] = [];
  for (let d = 0; d < maxLookback; d++) {
    times.push(minutesToTime(currentMinutes - d));
  }
  return times;
}

export async function handleScheduled(env: Env): Promise<void> {
  const db = createDb(env);
  const now = new Date();
  const { dateStr: today, totalMinutes: currentMinutes } = getJstDateTimeParts(now);

  console.log(`Running scheduler at ${now.toISOString()} (JST ${today} ${currentMinutes} min)`);

  const candidateTimes = relevantTimesForWindow(currentMinutes);
  const candidateUsers = await getUsersByTimings(db, candidateTimes);

  if (candidateUsers.length === 0) {
    await purgeOldNotificationLogs(db);
    return;
  }

  for (const user of candidateUsers) {
    const settings = user.settings;

    for (const [timing, timeStr] of Object.entries(settings.timings)) {
      const targetMinutes = timeToMinutes(timeStr);

      const shouldSend = shouldSendNotification({
        currentMinutes,
        targetMinutes,
        reminderInterval: settings.reminderInterval,
        maxReminderCount: settings.maxReminderCount
      });

      if (!shouldSend) {
        continue;
      }

      const unrecordedMeds = await hasUnrecordedMedications(
        db,
        user.uid,
        timing as TimingType,
        today
      );

      if (unrecordedMeds.length === 0) {
        continue;
      }

      // 冪等性: 同一 cron ウィンドウで既に送信済みならスキップ
      const windowStart = currentMinutes - (currentMinutes % CRON_INTERVAL);
      const alreadySent = await hasNotificationBeenSent(
        db,
        user.uid,
        today,
        timing,
        windowStart
      );
      if (alreadySent) {
        continue;
      }

      await sendReminderToUser(env, db, user, timing as TimingType, unrecordedMeds);
      await markNotificationSent(db, user.uid, today, timing, windowStart);
    }
  }

  // 10分以上前の冪等性ログを掃除 (KV 時代の TTL 10分の代替)
  await purgeOldNotificationLogs(db);
}
