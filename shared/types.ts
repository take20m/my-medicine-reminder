// フロントエンドと Workers の両方で共有するドメイン型定義。
// ビルド時のみ参照される純粋な型 + 定数であり、実行時依存は持たない。

export type TimingType = 'morning' | 'noon' | 'evening' | 'bedtime';

export const TIMING_LABELS: Record<TimingType, string> = {
  morning: '朝',
  noon: '昼',
  evening: '夕',
  bedtime: '就寝前'
};

export const TIMING_ORDER: TimingType[] = ['morning', 'noon', 'evening', 'bedtime'];

export interface UserSettings {
  timings: Record<TimingType, string>; // 各タイミングの時刻 (HH:mm)
  reminderInterval: number; // 再通知間隔（分）
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  settings: UserSettings;
  createdAt: string;
}

export interface Medication {
  id: string;
  name: string;
  description?: string;
  dosage: string;
  timings: TimingType[];
  active: boolean;
  createdAt: string;
}

export type RecordStatus = 'taken' | 'skipped' | 'pending';

export interface RecordEntry {
  medicationId: string;
  timing: TimingType;
  status: RecordStatus;
  recordedAt: string;
}

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  entries: RecordEntry[];
}
