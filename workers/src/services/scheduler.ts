import type { Env, TimingType, User, Medication } from '../types';
import {
  getAllUsers,
  getAllSubscriptions,
  getMedications,
  getDailyRecord,
  getUser
} from '../utils/kv';
import { sendPushNotification } from '../utils/webpush';
import { TIMING_LABELS } from '../types';

// 現在の日時を日本時間で取得
function getJapanTime(): Date {
  const now = new Date();
  // UTC+9
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

// 時刻文字列を分に変換
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// 現在の時刻（分）を取得
function getCurrentMinutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

// 今日の日付文字列を取得（YYYY-MM-DD）
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
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
  const subscription = await (await getAllSubscriptions(env.KV)).find(s => s.uid === user.uid);

  if (!subscription) {
    console.log(`No subscription for user ${user.uid}`);
    return;
  }

  const medicationNames = medications.map(m => m.name).join('、');
  const timingLabel = TIMING_LABELS[timing];

  try {
    await sendPushNotification(
      env,
      subscription.subscription,
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

// スケジュール処理のメインハンドラー
export async function handleScheduled(env: Env): Promise<void> {
  const japanTime = getJapanTime();
  const currentMinutes = getCurrentMinutes(japanTime);
  const today = getDateString(japanTime);

  console.log(`Running scheduler at ${japanTime.toISOString()}, minutes: ${currentMinutes}`);

  // 全ユーザーを取得
  const users = await getAllUsers(env.KV);

  for (const user of users) {
    const settings = user.settings;

    // 各タイミングをチェック
    for (const [timing, timeStr] of Object.entries(settings.timings)) {
      const targetMinutes = timeToMinutes(timeStr);
      const reminderInterval = settings.reminderInterval;

      // 通知タイミングかどうかチェック
      // - 設定時刻ちょうど
      // - または再通知間隔の倍数（設定時刻から reminderInterval 分後、2*reminderInterval 分後...）
      const diffMinutes = currentMinutes - targetMinutes;

      if (diffMinutes < 0) {
        // まだ時刻になっていない
        continue;
      }

      if (diffMinutes > 60) {
        // 1時間以上経過した場合はスキップ
        continue;
      }

      // 初回通知 or 再通知タイミングかチェック
      const isInitialNotification = diffMinutes === 0;
      const isReminderNotification = diffMinutes > 0 && diffMinutes % reminderInterval === 0;

      if (!isInitialNotification && !isReminderNotification) {
        continue;
      }

      // 未服用の薬があるかチェック
      const unrecordedMeds = await hasUnrecordedMedications(
        env.KV,
        user.uid,
        timing as TimingType,
        today
      );

      if (unrecordedMeds.length === 0) {
        // 全て服用済み
        continue;
      }

      // 通知を送信
      await sendReminderToUser(env, user, timing as TimingType, unrecordedMeds);
    }
  }
}
