import { Hono } from 'hono';
import type { Env, UserSettings } from '../types';
import { authMiddleware } from '../utils/auth';
import { createDb } from '../db/client';
import { getUser, updateUserSettings } from '../db/queries';

export const settingsRoutes = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

settingsRoutes.use('*', authMiddleware());

settingsRoutes.get('/', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const user = await getUser(db, uid);

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  return c.json({ success: true, data: user.settings });
});

settingsRoutes.put('/', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const body = await c.req.json<Partial<UserSettings>>();

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

  const user = await updateUserSettings(db, uid, body);

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  return c.json({ success: true, data: user.settings });
});
