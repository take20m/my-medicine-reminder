export * from '../../shared/types';
import type { TimingType } from '../../shared/types';

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
