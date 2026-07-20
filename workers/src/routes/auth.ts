import { Hono } from 'hono';
import type { Env } from '../types';
import { verifyFirebaseToken } from '../utils/auth';
import { createDb } from '../db/client';
import { getUser, createUser } from '../db/queries';

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
    const displayName = payload.firebase?.identities?.['google.com']?.[0] || payload.email || 'User';
    const email = payload.email || '';

    const db = createDb(c.env);
    let user = await getUser(db, uid);

    if (!user) {
      user = await createUser(db, uid, displayName, email);
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
