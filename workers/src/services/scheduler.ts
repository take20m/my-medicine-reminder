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
import { TIMING_LABELS } from '../types';

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
const CRON_INTERVAL = 5;

function isInCurrentWindow(targetMinutes: number, currentMinutes: number): boolean {
  const windowStart = currentMinutes - CRON_INTERVAL + 1;
  return targetMinutes >= windowStart && targetMinutes <= currentMinutes;
}

/**
 * 現在のウィンドウ + 過去60分以内 (再通知のため) を分単位で HH:MM 配列に展開。
 * SQL の WHERE 句で「ユーザーの設定時刻のいずれかがこの一覧に含まれる」と絞り込むのに使う。
 */
function relevantTimesForWindow(currentMinutes: number): string[] {
  const times: string[] = [];
  for (let d = 0; d < 60 + CRON_INTERVAL; d++) {
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
      const reminderInterval = settings.reminderInterval;
      const diffMinutes = currentMinutes - targetMinutes;

      if (diffMinutes < 0 || diffMinutes > 60) {
        continue;
      }

      const isInitialNotification = isInCurrentWindow(targetMinutes, currentMinutes);
      let isReminderNotification = false;
      if (diffMinutes > 0) {
        for (let d = diffMinutes - CRON_INTERVAL + 1; d <= diffMinutes; d++) {
          if (d > 0 && d % reminderInterval === 0) {
            isReminderNotification = true;
            break;
          }
        }
      }

      if (!isInitialNotification && !isReminderNotification) {
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
