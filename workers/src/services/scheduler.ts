import type { Env, TimingType, User, Medication } from '../types';
import {
  getUser,
  getPushSubscription,
  getMedications,
  getDailyRecord,
  getScheduleTimings,
  getScheduleUids,
  hasNotificationBeenSent,
  markNotificationSent
} from '../utils/kv';
import { sendPushNotification } from '../utils/webpush';
import { getJstDateTimeParts } from '../utils/date';
import { TIMING_LABELS } from '../types';

// 時刻文字列を分に変換
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// 指定タイミングで未服用の薬があるかチェック
async function hasUnrecordedMedications(
  kv: KVNamespace,
  uid: string,
  timing: TimingType,
  date: string
): Promise<Medication[]> {
  const medications = await getMedications(kv, uid);
  const record = await getDailyRecord(kv, uid, date);

  // このタイミングで服用する薬をフィルタ
  const medicationsForTiming = medications.filter(
    med => med.active && med.timings.includes(timing)
  );

  if (!record) {
    return medicationsForTiming;
  }

  // まだ記録されていない薬を返す
  return medicationsForTiming.filter(med => {
    const entry = record.entries.find(
      e => e.medicationId === med.id && e.timing === timing
    );
    return !entry || entry.status === 'pending';
  });
}

// 特定ユーザーに通知を送信
async function sendReminderToUser(
  env: Env,
  user: User,
  timing: TimingType,
  medications: Medication[]
): Promise<void> {
  const subscription = await getPushSubscription(env.KV, user.uid);

  if (!subscription) {
    console.log(`No subscription for user ${user.uid}`);
    return;
  }

  const medicationNames = medications.map(m => m.name).join('、');
  const timingLabel = TIMING_LABELS[timing];

  try {
    await sendPushNotification(
      env,
      subscription,
      {
        title: `${timingLabel}のお薬の時間です`,
        body: `${medicationNames}を服用してください`,
        tag: `reminder-${timing}`,
        data: {
          type: 'reminder',
          timing,
          medicationIds: medications.map(m => m.id),
          timestamp: new Date().toISOString()
        }
      }
    );
    console.log(`Sent reminder to ${user.uid} for ${timing}`);
  } catch (error) {
    console.error(`Failed to send reminder to ${user.uid}:`, error);
  }
}

// cron間隔（分）。wrangler.toml の crons = ["*/5 * * * *"] と一致させる
const CRON_INTERVAL = 5;

// 指定時刻が現在の cron ウィンドウ内にあるかチェック
// 例: currentMinutes=425, CRON_INTERVAL=5 → 421〜425 の範囲にあればtrue
function isInCurrentWindow(targetMinutes: number, currentMinutes: number): boolean {
  const windowStart = currentMinutes - CRON_INTERVAL + 1;
  return targetMinutes >= windowStart && targetMinutes <= currentMinutes;
}

// スケジュール処理のメインハンドラー
export async function handleScheduled(env: Env): Promise<void> {
  const now = new Date();
  const { dateStr: today, totalMinutes: currentMinutes } = getJstDateTimeParts(now);

  console.log(`Running scheduler at ${now.toISOString()} (JST ${today} ${currentMinutes} min)`);

  // スケジュールキャッシュから現在のcronウィンドウに該当しうる時刻を抽出
  const cachedTimings = await getScheduleTimings(env.KV);
  if (!cachedTimings || cachedTimings.length === 0) {
    console.log('No schedule timings registered, skipping');
    return;
  }

  const relevantTimings = cachedTimings.filter(timeStr => {
    const targetMinutes = timeToMinutes(timeStr);
    if (isInCurrentWindow(targetMinutes, currentMinutes)) return true;
    const diff = currentMinutes - targetMinutes;
    return diff > 0 && diff <= 60;
  });

  if (relevantTimings.length === 0) {
    console.log('No relevant timings in current window, skipping');
    return;
  }

  // 該当時刻の uid を時刻別インデックスから集約 (全ユーザー走査を回避)
  const relevantUids = new Set<string>();
  for (const time of relevantTimings) {
    const uids = await getScheduleUids(env.KV, time);
    for (const uid of uids) relevantUids.add(uid);
  }

  if (relevantUids.size === 0) return;

  for (const uid of relevantUids) {
    const user = await getUser(env.KV, uid);
    if (!user) continue;

    const settings = user.settings;

    for (const [timing, timeStr] of Object.entries(settings.timings)) {
      const targetMinutes = timeToMinutes(timeStr);
      const reminderInterval = settings.reminderInterval;
      const diffMinutes = currentMinutes - targetMinutes;

      if (diffMinutes < 0 || diffMinutes > 60) {
        continue;
      }

      // 初回通知: 設定時刻が現在のcronウィンドウ内にあるか
      const isInitialNotification = isInCurrentWindow(targetMinutes, currentMinutes);
      // 再通知: reminderInterval の倍数がウィンドウ内にあるか
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
        env.KV,
        user.uid,
        timing as TimingType,
        today
      );

      if (unrecordedMeds.length === 0) {
        continue;
      }

      // 冪等性: 同一 cron ウィンドウで既に送信済みならスキップ
      // (cron リトライ、タイミング境界の重複発火を防ぐ)
      const windowStart = currentMinutes - (currentMinutes % CRON_INTERVAL);
      const alreadySent = await hasNotificationBeenSent(
        env.KV,
        user.uid,
        today,
        timing,
        windowStart
      );
      if (alreadySent) {
        continue;
      }

      await sendReminderToUser(env, user, timing as TimingType, unrecordedMeds);
      await markNotificationSent(env.KV, user.uid, today, timing, windowStart);
    }
  }
}
