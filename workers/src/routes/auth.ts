import { Hono } from 'hono';
import type { Env } from '../types';
import { verifyFirebaseToken } from '../utils/auth';
import type { FirebaseTokenPayload } from '../utils/auth';
import { createDb } from '../db/client';
import { getUser, createUser, updateUserProfile } from '../db/queries';

export const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * 表示名を決める。
 * 以前は firebase.identities['google.com'][0] を使っていたが、これは Google の sub
 * (21桁の数字) であって名前ではなかった。name クレームを優先する。
 */
export function resolveDisplayName(payload: FirebaseTokenPayload): string {
  return payload.name || payload.email || 'User';
}

// Firebase トークン検証 & ユーザー作成/取得
authRoutes.post('/verify', async (c) => {
  try {
    const { token } = await c.req.json<{ token: string }>();

    if (!token) {
      return c.json({ success: false, error: 'Token is required' }, 400);
    }

    const payload = await verifyFirebaseToken(token, c.env.FIREBASE_PROJECT_ID);
    const uid = payload.sub;
    const displayName = resolveDisplayName(payload);
    const email = payload.email || '';

    const db = createDb(c.env);
    let user = await getUser(db, uid);

    if (!user) {
      user = await createUser(db, uid, displayName, email);
    } else if (user.displayName !== displayName || user.email !== email) {
      // 既存ユーザーの display_name には数字が入ったままなので、ログイン時に是正する
      await updateUserProfile(db, uid, displayName, email);
      user = { ...user, displayName, email };
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
