import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { authRoutes } from './routes/auth';
import { medicationRoutes } from './routes/medications';
import { recordRoutes } from './routes/records';
import { settingsRoutes } from './routes/settings';
import { pushRoutes } from './routes/push';
import { adminRoutes } from './routes/admin';
import { handleScheduled } from './services/scheduler';

const app = new Hono<{ Bindings: Env }>();

// CORS設定: 本番環境では localhost を許可しない
app.use('/api/*', (c, next) => {
  const origins = c.env.ENVIRONMENT === 'production'
    ? ['https://my-medicine-reminder.pages.dev']
    : ['http://localhost:5173', 'https://my-medicine-reminder.pages.dev'];
  return cors({ origin: origins, credentials: true })(c, next);
});

// ヘルスチェック
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// ルートのマウント
app.route('/api/auth', authRoutes);
app.route('/api/medications', medicationRoutes);
app.route('/api/records', recordRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/push', pushRoutes);
app.route('/api/admin', adminRoutes);

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
