import { Hono } from 'hono';
import type { Env, RecordEntry, TimingType, RecordStatus } from '../types';
import { authMiddleware } from '../utils/auth';
import { createDb } from '../db/client';
import { getDailyRecord, saveDailyRecord, getRecordsInRange } from '../db/queries';

export const recordRoutes = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

recordRoutes.use('*', authMiddleware());

recordRoutes.get('/:date', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const date = c.req.param('date');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
  }

  const record = await getDailyRecord(db, uid, date);

  if (!record) {
    return c.json({
      success: true,
      data: { date, entries: [] }
    });
  }

  return c.json({ success: true, data: record });
});

recordRoutes.get('/', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const from = c.req.query('from');
  const to = c.req.query('to');

  if (!from || !to) {
    return c.json({ success: false, error: 'from and to query parameters are required' }, 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return c.json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
  }

  const records = await getRecordsInRange(db, uid, from, to);

  return c.json({ success: true, data: records });
});

recordRoutes.post('/', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const body = await c.req.json<{
    date: string;
    medicationId: string;
    timing: TimingType;
    status: RecordStatus;
  }>();

  if (!body.date || !body.medicationId || !body.timing || !body.status) {
    return c.json({ success: false, error: 'Missing required fields' }, 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return c.json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
  }

  const validTimings: TimingType[] = ['morning', 'noon', 'evening', 'bedtime'];
  if (!validTimings.includes(body.timing)) {
    return c.json({ success: false, error: 'Invalid timing' }, 400);
  }

  const validStatuses: RecordStatus[] = ['taken', 'skipped', 'pending'];
  if (!validStatuses.includes(body.status)) {
    return c.json({ success: false, error: 'Invalid status' }, 400);
  }

  let record = await getDailyRecord(db, uid, body.date);
  if (!record) {
    record = { date: body.date, entries: [] };
  }

  const existingIndex = record.entries.findIndex(
    e => e.medicationId === body.medicationId && e.timing === body.timing
  );

  const entry: RecordEntry = {
    medicationId: body.medicationId,
    timing: body.timing,
    status: body.status,
    recordedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    record.entries[existingIndex] = entry;
  } else {
    record.entries.push(entry);
  }

  await saveDailyRecord(db, uid, record);

  return c.json({ success: true, data: record });
});
