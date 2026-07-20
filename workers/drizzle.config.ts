import type { Config } from 'drizzle-kit';

// SQL 生成 (drizzle-kit generate) 専用の設定。
// 適用は wrangler d1 migrations apply で行う (drizzle-kit migrate は使わない)。
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite'
} satisfies Config;
