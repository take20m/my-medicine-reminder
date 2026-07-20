import { Hono } from 'hono';
import type { Env, Medication, TimingType } from '../types';
import { authMiddleware } from '../utils/auth';
import { createDb } from '../db/client';
import { getMedications, getMedication, saveMedication, deleteMedication } from '../db/queries';

export const medicationRoutes = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

medicationRoutes.use('*', authMiddleware());

medicationRoutes.get('/', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const medications = await getMedications(db, uid);

  const activeOnly = c.req.query('active') === 'true';
  const filtered = activeOnly ? medications.filter(m => m.active) : medications;

  return c.json({ success: true, data: filtered });
});

medicationRoutes.get('/:id', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const id = c.req.param('id');

  const medication = await getMedication(db, uid, id);
  if (!medication) {
    return c.json({ success: false, error: 'Medication not found' }, 404);
  }

  return c.json({ success: true, data: medication });
});

medicationRoutes.post('/', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const body = await c.req.json<{
    name: string;
    description?: string;
    dosage: string;
    timings: TimingType[];
  }>();

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

  await saveMedication(db, uid, medication);

  return c.json({ success: true, data: medication }, 201);
});

medicationRoutes.put('/:id', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<Medication>>();

  const existing = await getMedication(db, uid, id);
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

  await saveMedication(db, uid, updated);

  return c.json({ success: true, data: updated });
});

medicationRoutes.delete('/:id', async (c) => {
  const db = createDb(c.env);
  const uid = c.get('uid');
  const id = c.req.param('id');

  const existing = await getMedication(db, uid, id);
  if (!existing) {
    return c.json({ success: false, error: 'Medication not found' }, 404);
  }

  await deleteMedication(db, uid, id);

  return c.json({ success: true });
});
