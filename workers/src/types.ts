// タイミングの種類
export type TimingType = 'morning' | 'noon' | 'evening' | 'bedtime';

export const TIMING_LABELS: Record<TimingType, string> = {
  morning: '朝',
  noon: '昼',
  evening: '夕',
  bedtime: '就寝前'
};

export const TIMING_ORDER: TimingType[] = ['morning', 'noon', 'evening', 'bedtime'];

// ユーザー設定
export interface UserSettings {
  timings: Record<TimingType, string>; // 各タイミングの時刻 (HH:mm)
  reminderInterval: number; // 再通知間隔（分）
}

// ユーザー情報
export interface User {
  uid: string;
  displayName: string;
  email: string;
  settings: UserSettings;
  createdAt: string;
}

// 薬情報
export interface Medication {
  id: string;
  name: string;
  description?: string;
  dosage: string;
  timings: TimingType[];
  active: boolean;
  createdAt: string;
}

// 服用状態
export type RecordStatus = 'taken' | 'skipped' | 'pending';

// 服用記録エントリ
export interface RecordEntry {
  medicationId: string;
  timing: TimingType;
  status: RecordStatus;
  recordedAt: string;
}

// 日別服用記録
export interface DailyRecord {
  date: string; // YYYY-MM-DD
  entries: RecordEntry[];
}

// WebPush購読情報
export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
}

// 送信待ち通知
export interface PendingNotification {
  uid: string;
  timing: TimingType;
  scheduledAt: string;
  nextRetryAt?: string;
  retryCount: number;
}

// Cloudflare Workers 環境変数
export interface Env {
  KV: KVNamespace;
  ENVIRONMENT: string;
  FIREBASE_PROJECT_ID: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}
