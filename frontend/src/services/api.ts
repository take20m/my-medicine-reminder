import { getIdToken } from './firebase';
import type {
  ApiResponse,
  Medication,
  DailyRecord,
  UserSettings,
  TimingType,
  RecordStatus
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getIdToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' };
    }

    return data;
  } catch (error) {
    console.error('API error:', error);
    return { success: false, error: 'Network error' };
  }
}

// 認証
export async function verifyAuth(token: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  return response.json();
}

// 薬一覧取得
export async function getMedications(activeOnly = false): Promise<ApiResponse<Medication[]>> {
  const query = activeOnly ? '?active=true' : '';
  return fetchWithAuth<Medication[]>(`/medications${query}`);
}

// 薬詳細取得
export async function getMedication(id: string): Promise<ApiResponse<Medication>> {
  return fetchWithAuth<Medication>(`/medications/${id}`);
}

// 薬登録
export async function createMedication(data: {
  name: string;
  description?: string;
  dosage: string;
  timings: TimingType[];
}): Promise<ApiResponse<Medication>> {
  return fetchWithAuth<Medication>('/medications', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// 薬更新
export async function updateMedication(
  id: string,
  data: Partial<Medication>
): Promise<ApiResponse<Medication>> {
  return fetchWithAuth<Medication>(`/medications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

// 薬削除
export async function deleteMedication(id: string): Promise<ApiResponse<void>> {
  return fetchWithAuth<void>(`/medications/${id}`, {
    method: 'DELETE'
  });
}

// 日別記録取得
export async function getDailyRecord(date: string): Promise<ApiResponse<DailyRecord>> {
  return fetchWithAuth<DailyRecord>(`/records/${date}`);
}

// 期間指定記録取得
export async function getRecordsInRange(
  from: string,
  to: string
): Promise<ApiResponse<DailyRecord[]>> {
  return fetchWithAuth<DailyRecord[]>(`/records?from=${from}&to=${to}`);
}

// 服用記録登録
export async function recordMedication(data: {
  date: string;
  medicationId: string;
  timing: TimingType;
  status: RecordStatus;
}): Promise<ApiResponse<DailyRecord>> {
  return fetchWithAuth<DailyRecord>('/records', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// 設定取得
export async function getSettings(): Promise<ApiResponse<UserSettings>> {
  return fetchWithAuth<UserSettings>('/settings');
}

// 設定更新
export async function updateSettings(
  data: Partial<UserSettings>
): Promise<ApiResponse<UserSettings>> {
  return fetchWithAuth<UserSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

// VAPID公開鍵取得
export async function getVapidKey(): Promise<ApiResponse<{ publicKey: string }>> {
  return fetchWithAuth<{ publicKey: string }>('/push/vapid-key');
}

// WebPush購読登録
export async function subscribePush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<ApiResponse<void>> {
  return fetchWithAuth<void>('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription)
  });
}

// WebPush購読解除
export async function unsubscribePush(): Promise<ApiResponse<void>> {
  return fetchWithAuth<void>('/push/subscribe', {
    method: 'DELETE'
  });
}

// テスト通知送信
export async function sendTestNotification(): Promise<ApiResponse<void>> {
  return fetchWithAuth<void>('/push/test', {
    method: 'POST'
  });
}

// デバッグ: ペイロードなしテスト通知
export async function sendRawTestNotification(): Promise<ApiResponse<any>> {
  return fetchWithAuth<any>('/push/test-raw', {
    method: 'POST'
  });
}
