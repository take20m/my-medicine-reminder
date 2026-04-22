import type { Env, TimingType, User, Medication } from '../types';
import {
  getAllUsers,
  getPushSubscription,
  getMedications,
  getDailyRecord,
  getScheduleTimings
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

  // 早期リターン: スケジュールキャッシュを1 GETで読み、
  // 現在のウィンドウ内に通知時刻がなければ即終了
  const cachedTimings = await getScheduleTimings(env.KV);
  if (cachedTimings) {
    const hasRelevantTiming = cachedTimings.some(timeStr => {
      const targetMinutes = timeToMinutes(timeStr);
      // 初回通知のウィンドウチェック
      if (isInCurrentWindow(targetMinutes, currentMinutes)) return true;
      // 再通知: 設定時刻から60分以内かチェック（詳細はユーザーごとに判定）
      const diff = currentMinutes - targetMinutes;
      return diff > 0 && diff <= 60;
    });

    if (!hasRelevantTiming) {
      console.log('No relevant timings in current window, skipping');
      return;
    }
  }

  // 該当タイミングあり → 全ユーザーを取得して処理
  const users = await getAllUsers(env.KV);

  for (const user of users) {
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

      await sendReminderToUser(env, user, timing as TimingType, unrecordedMeds);
    }
  }
}
