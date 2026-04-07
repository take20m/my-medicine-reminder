import { Hono } from 'hono';
import type { Env, UserSettings } from '../types';
import { authMiddleware } from '../utils/auth';
import { getUser, updateUserSettings, getAllUsers, saveScheduleTimings } from '../utils/kv';

export const settingsRoutes = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

// 認証ミドルウェアを全ルートに適用
settingsRoutes.use('*', authMiddleware());

// ユーザー設定取得
settingsRoutes.get('/', async (c) => {
  const uid = c.get('uid');
  const user = await getUser(c.env.KV, uid);

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  return c.json({ success: true, data: user.settings });
});

// ユーザー設定更新
settingsRoutes.put('/', async (c) => {
  const uid = c.get('uid');
  const body = await c.req.json<Partial<UserSettings>>();

  // バリデーション
  if (body.timings) {
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    for (const [timing, time] of Object.entries(body.timings)) {
      if (!timePattern.test(time)) {
        return c.json({ success: false, error: `Invalid time format for ${timing}. Use HH:mm` }, 400);
      }
    }
  }

  if (body.reminderInterval !== undefined) {
    if (typeof body.reminderInterval !== 'number' || body.reminderInterval < 5 || body.reminderInterval > 60) {
      return c.json({ success: false, error: 'Reminder interval must be between 5 and 60 minutes' }, 400);
    }
  }

  const user = await updateUserSettings(c.env.KV, uid, body);

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  // スケジュールキャッシュを再構築
  const allUsers = await getAllUsers(c.env.KV);
  const allTimings = new Set<string>();
  for (const u of allUsers) {
    for (const time of Object.values(u.settings.timings)) {
      allTimings.add(time);
    }
  }
  await saveScheduleTimings(c.env.KV, [...allTimings].sort());

  return c.json({ success: true, data: user.settings });
});
