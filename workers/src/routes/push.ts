import { Hono } from 'hono';
import type { Env, PushSubscriptionData } from '../types';
import { authMiddleware } from '../utils/auth';
import { getPushSubscription, savePushSubscription, deletePushSubscription, getUser } from '../utils/kv';
import { sendPushNotification, sendRawPush } from '../utils/webpush';

export const pushRoutes = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

// 認証ミドルウェアを全ルートに適用
pushRoutes.use('*', authMiddleware());

// VAPID公開鍵取得
pushRoutes.get('/vapid-key', async (c) => {
  return c.json({
    success: true,
    data: { publicKey: c.env.VAPID_PUBLIC_KEY }
  });
});

// WebPush購読登録
pushRoutes.post('/subscribe', async (c) => {
  const uid = c.get('uid');
  const body = await c.req.json<{
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }>();

  // バリデーション
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ success: false, error: 'Invalid subscription data' }, 400);
  }

  const subscription: PushSubscriptionData = {
    endpoint: body.endpoint,
    keys: body.keys,
    createdAt: new Date().toISOString()
  };

  await savePushSubscription(c.env.KV, uid, subscription);

  return c.json({ success: true });
});

// WebPush購読解除
pushRoutes.delete('/subscribe', async (c) => {
  const uid = c.get('uid');

  await deletePushSubscription(c.env.KV, uid);

  return c.json({ success: true });
});

// テスト通知送信
pushRoutes.post('/test', async (c) => {
  const uid = c.get('uid');

  const subscription = await getPushSubscription(c.env.KV, uid);
  if (!subscription) {
    return c.json({ success: false, error: 'No subscription found' }, 404);
  }

  const user = await getUser(c.env.KV, uid);

  try {
    const result = await sendPushNotification(
      c.env,
      subscription,
      {
        title: 'おくすりリマインダー',
        body: 'テスト通知です。通知の設定は正常に動作しています。',
        tag: 'test',
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      }
    );

    return c.json({
      success: result.success,
      data: { pushServiceStatus: result.status, pushServiceResponse: result.body }
    });
  } catch (error) {
    console.error('Push notification error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    return c.json({ success: false, error: message }, 500);
  }
});

// デバッグ: ペイロードなしでプッシュ送信（暗号化の切り分け用）
pushRoutes.post('/test-raw', async (c) => {
  const uid = c.get('uid');

  const subscription = await getPushSubscription(c.env.KV, uid);
  if (!subscription) {
    return c.json({ success: false, error: 'No subscription found' }, 404);
  }

  try {
    const result = await sendRawPush(c.env, subscription);
    return c.json({
      success: result.success,
      data: { pushServiceStatus: result.status, pushServiceResponse: result.body }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send';
    return c.json({ success: false, error: message }, 500);
  }
});
