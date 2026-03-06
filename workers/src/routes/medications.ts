import { Hono } from 'hono';
import type { Env, Medication, TimingType } from '../types';
import { authMiddleware } from '../utils/auth';
import { getMedications, getMedication, saveMedication, deleteMedication } from '../utils/kv';

export const medicationRoutes = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

// 認証ミドルウェアを全ルートに適用
medicationRoutes.use('*', authMiddleware());

// 薬一覧取得
medicationRoutes.get('/', async (c) => {
  const uid = c.get('uid');
  const medications = await getMedications(c.env.KV, uid);

  // アクティブな薬のみをフィルタするオプション
  const activeOnly = c.req.query('active') === 'true';
  const filtered = activeOnly ? medications.filter(m => m.active) : medications;

  return c.json({ success: true, data: filtered });
});

// 薬詳細取得
medicationRoutes.get('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  const medication = await getMedication(c.env.KV, uid, id);
  if (!medication) {
    return c.json({ success: false, error: 'Medication not found' }, 404);
  }

  return c.json({ success: true, data: medication });
});

// 薬登録
medicationRoutes.post('/', async (c) => {
  const uid = c.get('uid');
  const body = await c.req.json<{
    name: string;
    description?: string;
    dosage: string;
    timings: TimingType[];
  }>();

  // バリデーション
  if (!body.name || !body.dosage || !body.timings?.length) {
    return c.json({ success: false, error: 'Missing required fields' }, 400);
  }

  const medication: Medication = {
    id: crypto.randomUUID(),
    name: body.name,
    description: body.description,
    dosage: body.dosage,
    timings: body.timings,
    active: true,
    createdAt: new Date().toISOString()
  };

  await saveMedication(c.env.KV, uid, medication);

  return c.json({ success: true, data: medication }, 201);
});

// 薬更新
medicationRoutes.put('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<Medication>>();

  const existing = await getMedication(c.env.KV, uid, id);
  if (!existing) {
    return c.json({ success: false, error: 'Medication not found' }, 404);
  }

  const updated: Medication = {
    ...existing,
    name: body.name ?? existing.name,
    description: body.description ?? existing.description,
    dosage: body.dosage ?? existing.dosage,
    timings: body.timings ?? existing.timings,
    active: body.active ?? existing.active
  };

  await saveMedication(c.env.KV, uid, updated);

  return c.json({ success: true, data: updated });
});

// 薬削除
medicationRoutes.delete('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  const existing = await getMedication(c.env.KV, uid, id);
  if (!existing) {
    return c.json({ success: false, error: 'Medication not found' }, 404);
  }

  await deleteMedication(c.env.KV, uid, id);

  return c.json({ success: true });
});
