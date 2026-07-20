import { Hono } from 'hono';
import type { Env, PushSubscriptionData } from '../types';
import { authMiddleware } from '../utils/auth';
import { createDb } from '../db/client';
import { getPushSubscription, savePushSubscription, deletePushSubscription } from '../db/queries';
import { sendPushNotification } from '../utils/webpush';

export const pushRoutes = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

pushRoutes.use('*', authMiddleware());

pushRoutes.get('/vapid-key', async (c) => {
  return c.json({
    success: true,
    data: { publicKey: c.env.VAPID_PUBLIC_KEY }
  });
});

pushRoutes.post('/subscribe', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const body = await c.req.json<{
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }>();

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ success: false, error: 'Invalid subscription data' }, 400);
  }

  const subscription: PushSubscriptionData = {
    endpoint: body.endpoint,
    keys: body.keys,
    createdAt: new Date().toISOString()
  };

  await savePushSubscription(db, uid, subscription);

  return c.json({ success: true });
});

pushRoutes.delete('/subscribe', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');

  await deletePushSubscription(db, uid);

  return c.json({ success: true });
});

pushRoutes.post('/test', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');

  const subscription = await getPushSubscription(db, uid);
  if (!subscription) {
    return c.json({ success: false, error: 'No subscription found' }, 404);
  }

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

    return c.json({ success: result.success });
  } catch (error) {
    console.error('Push notification error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    return c.json({ success: false, error: message }, 500);
  }
});
