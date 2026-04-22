import { Hono } from 'hono';
import type { Env, DailyRecord, RecordEntry } from '../types';
import { authMiddleware } from '../utils/auth';
import { applyScheduleIndex, getDailyRecord, getUser, saveDailyRecord } from '../utils/kv';
import { formatJstDate } from '../utils/date';

export const adminRoutes = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

adminRoutes.use('*', authMiddleware());

interface MigrationChange {
  oldKey: string;
  newDate: string;
  entryCount: number;
  merged: boolean;
}

interface MigrationResult {
  dryRun: boolean;
  scanned: number;
  migrated: number;
  skippedNoEntries: number;
  changes: MigrationChange[];
}

function mergeEntries(base: RecordEntry[], incoming: RecordEntry[]): RecordEntry[] {
  const map = new Map<string, RecordEntry>();
  for (const e of base) {
    map.set(`${e.medicationId}:${e.timing}`, e);
  }
  for (const e of incoming) {
    const key = `${e.medicationId}:${e.timing}`;
    const existing = map.get(key);
    if (!existing || existing.recordedAt < e.recordedAt) {
      map.set(key, e);
    }
  }
  return Array.from(map.values());
}

// UTCベースで保存された records:uid:YYYY-MM-DD を JST 日付キーへ移行する
adminRoutes.post('/migrate-records-tz', async (c) => {
  const uid = c.get('uid');
  const dryRun = c.req.query('dryRun') === 'true';
  const prefix = `records:${uid}:`;

  const result: MigrationResult = {
    dryRun,
    scanned: 0,
    migrated: 0,
    skippedNoEntries: 0,
    changes: []
  };

  let cursor: string | undefined;
  do {
    const listResult = await c.env.KV.list({ prefix, cursor });
    for (const key of listResult.keys) {
      result.scanned++;

      const raw = await c.env.KV.get(key.name);
      if (!raw) continue;
      const record: DailyRecord = JSON.parse(raw);

      if (!record.entries || record.entries.length === 0) {
        result.skippedNoEntries++;
        continue;
      }

      // 最初の recordedAt から JST 日付を算出
      const firstRecordedAt = record.entries[0].recordedAt;
      const correctDate = formatJstDate(new Date(firstRecordedAt));

      if (correctDate === record.date) continue;

      const correctKey = `records:${uid}:${correctDate}`;
      const existing = await getDailyRecord(c.env.KV, uid, correctDate);

      const mergedEntries = existing
        ? mergeEntries(existing.entries, record.entries)
        : record.entries;

      const mergedRecord: DailyRecord = {
        date: correctDate,
        entries: mergedEntries
      };

      result.changes.push({
        oldKey: key.name,
        newDate: correctDate,
        entryCount: record.entries.length,
        merged: Boolean(existing)
      });
      result.migrated++;

      if (!dryRun) {
        await saveDailyRecord(c.env.KV, uid, mergedRecord);
        if (key.name !== correctKey) {
          await c.env.KV.delete(key.name);
        }
      }
    }
    cursor = listResult.list_complete ? undefined : listResult.cursor;
  } while (cursor);

  return c.json({ success: true, data: result });
});

// スケジュールインデックス (schedule:uids:{HH:MM}) を呼び出しユーザー分のみ再構築
// schedule:uids:* 導入前に作られたユーザーが cron で通知されなくなる問題の移行用
adminRoutes.post('/rebuild-schedule-index', async (c) => {
  const uid = c.get('uid');
  const user = await getUser(c.env.KV, uid);
  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const times = Object.values(user.settings.timings);
  await applyScheduleIndex(c.env.KV, uid, [], times);

  return c.json({ success: true, data: { uid, times } });
});
