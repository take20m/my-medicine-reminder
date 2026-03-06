import { Hono } from 'hono';
import type { Env, DailyRecord, RecordEntry, TimingType, RecordStatus } from '../types';
import { authMiddleware } from '../utils/auth';
import { getDailyRecord, saveDailyRecord, getRecordsInRange } from '../utils/kv';

export const recordRoutes = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

// 認証ミドルウェアを全ルートに適用
recordRoutes.use('*', authMiddleware());

// 日別記録取得
recordRoutes.get('/:date', async (c) => {
  const uid = c.get('uid');
  const date = c.req.param('date');

  // 日付形式のバリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
  }

  const record = await getDailyRecord(c.env.KV, uid, date);

  // レコードがない場合は空のレコードを返す
  if (!record) {
    return c.json({
      success: true,
      data: { date, entries: [] }
    });
  }

  return c.json({ success: true, data: record });
});

// 期間指定記録取得
recordRoutes.get('/', async (c) => {
  const uid = c.get('uid');
  const from = c.req.query('from');
  const to = c.req.query('to');

  if (!from || !to) {
    return c.json({ success: false, error: 'from and to query parameters are required' }, 400);
  }

  // 日付形式のバリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return c.json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
  }

  const records = await getRecordsInRange(c.env.KV, uid, from, to);

  return c.json({ success: true, data: records });
});

// 服用記録登録
recordRoutes.post('/', async (c) => {
  const uid = c.get('uid');
  const body = await c.req.json<{
    date: string;
    medicationId: string;
    timing: TimingType;
    status: RecordStatus;
  }>();

  // バリデーション
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

  // 既存のレコードを取得または新規作成
  let record = await getDailyRecord(c.env.KV, uid, body.date);
  if (!record) {
    record = { date: body.date, entries: [] };
  }

  // 同じ薬・同じタイミングの既存エントリを検索
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
    // 既存エントリを更新
    record.entries[existingIndex] = entry;
  } else {
    // 新規エントリを追加
    record.entries.push(entry);
  }

  await saveDailyRecord(c.env.KV, uid, record);

  return c.json({ success: true, data: record });
});
