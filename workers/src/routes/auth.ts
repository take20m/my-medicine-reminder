import { Hono } from 'hono';
import type { Env } from '../types';
import { verifyFirebaseToken } from '../utils/auth';
import { getUser, createUser, getAllUsers, saveScheduleTimings } from '../utils/kv';

export const authRoutes = new Hono<{ Bindings: Env }>();

// Firebase トークン検証 & ユーザー作成/取得
authRoutes.post('/verify', async (c) => {
  try {
    const { token } = await c.req.json<{ token: string }>();

    if (!token) {
      return c.json({ success: false, error: 'Token is required' }, 400);
    }

    const payload = await verifyFirebaseToken(token, c.env.FIREBASE_PROJECT_ID);
    const uid = payload.sub;

    // ユーザーが存在するか確認
    let user = await getUser(c.env.KV, uid);

    // 存在しない場合は新規作成
    if (!user) {
      const displayName = payload.firebase?.identities?.['google.com']?.[0] || payload.email || 'User';
      user = await createUser(c.env.KV, uid, displayName, payload.email || '');

      // スケジュールキャッシュを再構築
      const allUsers = await getAllUsers(c.env.KV);
      const allTimings = new Set<string>();
      for (const u of allUsers) {
        for (const time of Object.values(u.settings.timings)) {
          allTimings.add(time);
        }
      }
      await saveScheduleTimings(c.env.KV, [...allTimings].sort());
    }

    return c.json({
      success: true,
      data: {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        settings: user.settings
      }
    });
  } catch (error) {
    console.error('Auth verify error:', error);
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
});
