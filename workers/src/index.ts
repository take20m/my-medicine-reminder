import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { authRoutes } from './routes/auth';
import { medicationRoutes } from './routes/medications';
import { recordRoutes } from './routes/records';
import { settingsRoutes } from './routes/settings';
import { pushRoutes } from './routes/push';
import { handleScheduled } from './services/scheduler';

const app = new Hono<{ Bindings: Env }>();

// CORS設定
app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'https://my-medicine-reminder.pages.dev'],
  credentials: true
}));

// ヘルスチェック
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// ルートのマウント
app.route('/api/auth', authRoutes);
app.route('/api/medications', medicationRoutes);
app.route('/api/records', recordRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/push', pushRoutes);

// 404
app.notFound((c) => c.json({ success: false, error: 'Not Found' }, 404));

// エラーハンドリング
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ success: false, error: 'Internal Server Error' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(env));
  }
};
