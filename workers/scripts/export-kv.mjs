// KV の全データをエクスポートして kv-dump.json に保存する。
// 使い方: node scripts/export-kv.mjs
// 注意: kv-dump.json は個人情報を含むためコミット禁止 (.gitignore 済み)。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const execFileAsync = promisify(execFile);

const NAMESPACE_ID = '943a26afb8fd4103992f92c2920f21dc';
// 移行対象の prefix。notif:* (短命TTL) / schedule:* / system:* は移行不要のため除外。
const TARGET_PREFIXES = ['users:', 'medications:', 'records:', 'subscriptions:'];

const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'kv-dump.json');

async function wrangler(args) {
  const { stdout } = await execFileAsync('npx', ['wrangler', ...args], {
    maxBuffer: 64 * 1024 * 1024
  });
  return stdout;
}

async function main() {
  console.error('Listing keys...');
  const listRaw = await wrangler(['kv', 'key', 'list', '--namespace-id', NAMESPACE_ID]);
  const allKeys = JSON.parse(listRaw).map(k => k.name);
  const targetKeys = allKeys.filter(name => TARGET_PREFIXES.some(p => name.startsWith(p)));
  const skipped = allKeys.length - targetKeys.length;
  console.error(`${allKeys.length} keys total, ${targetKeys.length} to export (${skipped} skipped: notif/schedule/system)`);

  const dump = {};
  let i = 0;
  for (const key of targetKeys) {
    i++;
    const value = await wrangler(['kv', 'key', 'get', key, '--namespace-id', NAMESPACE_ID]);
    dump[key] = value;
    console.error(`[${i}/${targetKeys.length}] ${key}`);
  }

  await writeFile(OUT_PATH, JSON.stringify(dump, null, 2));
  console.error(`Wrote ${OUT_PATH} (${targetKeys.length} keys)`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
