import { useState, useEffect } from 'preact/hooks';
import { useAuth } from '../hooks/useAuth';
import { getSettings, updateSettings, getVapidKey, subscribePush, unsubscribePush, sendTestNotification } from '../services/api';
import type { UserSettings, TimingType } from '../types';
import { TIMING_LABELS, TIMING_ORDER } from '../types';

export function SettingsPage() {
  const { user, signOut, refreshUser } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
    checkPushSubscription();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const result = await getSettings();
      if (result.success && result.data) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushEnabled(!!subscription);
    } catch (error) {
      console.error('Failed to check push subscription:', error);
    }
  }

  async function handleTimingChange(timing: TimingType, value: string) {
    if (!settings) return;

    const newSettings = {
      ...settings,
      timings: { ...settings.timings, [timing]: value }
    };
    setSettings(newSettings);
  }

  async function handleIntervalChange(value: number) {
    if (!settings) return;

    const newSettings = { ...settings, reminderInterval: value };
    setSettings(newSettings);
  }

  async function saveSettings() {
    if (!settings) return;

    setSaving(true);
    setMessage(null);

    try {
      const result = await updateSettings(settings);
      if (result.success) {
        setMessage({ type: 'success', text: '設定を保存しました' });
        await refreshUser();
      } else {
        setMessage({ type: 'error', text: result.error || '保存に失敗しました' });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: '保存に失敗しました' });
    } finally {
      setSaving(false);
    }
  }

  async function togglePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMessage({ type: 'error', text: 'このブラウザはプッシュ通知に対応していません' });
      return;
    }

    setPushLoading(true);
    setMessage(null);

    try {
      if (pushEnabled) {
        // 購読解除
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
        await unsubscribePush();
        setPushEnabled(false);
        setMessage({ type: 'success', text: '通知を無効にしました' });
      } else {
        // 購読登録
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setMessage({ type: 'error', text: '通知の許可が必要です' });
          return;
        }

        const vapidResult = await getVapidKey();
        if (!vapidResult.success || !vapidResult.data) {
          setMessage({ type: 'error', text: 'VAPID鍵の取得に失敗しました' });
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidResult.data.publicKey)
        });

        const subscriptionJson = subscription.toJSON();
        await subscribePush({
          endpoint: subscriptionJson.endpoint!,
          keys: {
            p256dh: subscriptionJson.keys!.p256dh!,
            auth: subscriptionJson.keys!.auth!
          }
        });

        setPushEnabled(true);
        setMessage({ type: 'success', text: '通知を有効にしました' });
      }
    } catch (error) {
      console.error('Failed to toggle push:', error);
      setMessage({ type: 'error', text: '通知設定の変更に失敗しました' });
    } finally {
      setPushLoading(false);
    }
  }

  async function handleTestNotification() {
    setTestSending(true);
    setMessage(null);

    try {
      const result = await sendTestNotification();
      if (result.success) {
        setMessage({ type: 'success', text: 'テスト通知を送信しました' });
      } else {
        setMessage({ type: 'error', text: result.error || 'テスト通知の送信に失敗しました' });
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      setMessage({ type: 'error', text: 'テスト通知の送信に失敗しました' });
    } finally {
      setTestSending(false);
    }
  }

  async function handleSignOut() {
    if (!confirm('ログアウトしますか？')) return;

    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  }

  if (loading) {
    return (
      <div class="container flex items-center justify-center" style={{ padding: 'var(--spacing-xl)' }}>
        <div class="spinner" />
      </div>
    );
  }

  return (
    <div class="container" style={{ padding: 'var(--spacing-md)' }}>
      <h2 style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: 600,
        marginBottom: 'var(--spacing-md)'
      }}>
        設定
      </h2>

      {message && (
        <div style={{
          background: message.type === 'success' ? '#f0fff4' : '#fef2f2',
          color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radius)',
          marginBottom: 'var(--spacing-md)',
          fontSize: 'var(--font-size-sm)'
        }}>
          {message.text}
        </div>
      )}

      {/* 服用時刻設定 */}
      <div class="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 600,
          marginBottom: 'var(--spacing-md)'
        }}>
          服用時刻
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {TIMING_ORDER.map(timing => (
            <div key={timing} class="flex items-center justify-between">
              <label style={{ fontWeight: 500 }}>
                {TIMING_LABELS[timing]}
              </label>
              <input
                type="time"
                value={settings?.timings[timing] || ''}
                onInput={(e) => handleTimingChange(timing, (e.target as HTMLInputElement).value)}
                class="form-input"
                style={{ width: '120px' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 再通知間隔設定 */}
      <div class="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 600,
          marginBottom: 'var(--spacing-md)'
        }}>
          再通知間隔
        </h3>
        <p style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-gray-600)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          薬を飲み忘れた場合に再通知する間隔
        </p>
        <select
          value={settings?.reminderInterval || 15}
          onChange={(e) => handleIntervalChange(parseInt((e.target as HTMLSelectElement).value))}
          class="form-input"
        >
          <option value="5">5分</option>
          <option value="10">10分</option>
          <option value="15">15分</option>
          <option value="30">30分</option>
          <option value="60">60分</option>
        </select>
      </div>

      <button
        onClick={saveSettings}
        disabled={saving}
        class="btn btn-primary btn-block"
        style={{ marginBottom: 'var(--spacing-lg)' }}
      >
        {saving ? (
          <div class="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
        ) : (
          '設定を保存'
        )}
      </button>

      {/* 通知設定 */}
      <div class="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 600,
          marginBottom: 'var(--spacing-md)'
        }}>
          プッシュ通知
        </h3>
        <div class="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-md)' }}>
          <span>通知を受け取る</span>
          <button
            onClick={togglePush}
            disabled={pushLoading}
            style={{
              width: '60px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              background: pushEnabled ? 'var(--color-primary)' : 'var(--color-gray-300)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background var(--transition-fast)'
            }}
          >
            <span style={{
              position: 'absolute',
              top: '2px',
              left: pushEnabled ? '30px' : '2px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--color-white)',
              transition: 'left var(--transition-fast)',
              boxShadow: 'var(--shadow-sm)'
            }} />
          </button>
        </div>
        {pushEnabled && (
          <button
            onClick={handleTestNotification}
            disabled={testSending}
            class="btn btn-outline btn-block"
          >
            {testSending ? (
              <div class="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
            ) : (
              'テスト通知を送信'
            )}
          </button>
        )}
      </div>

      {/* アカウント情報 */}
      <div class="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 600,
          marginBottom: 'var(--spacing-md)'
        }}>
          アカウント
        </h3>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <p style={{ fontWeight: 500 }}>{user?.displayName}</p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-600)' }}>
            {user?.email}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          class="btn btn-outline btn-block"
          style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}

// VAPID公開鍵をUint8Arrayに変換
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}
