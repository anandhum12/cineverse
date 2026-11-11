// Compiles tests/*.test.ts with esbuild (resolving the @/ alias) and runs them with node:test.
import { build } from 'esbuild';
import { readdirSync, mkdirSync, rmSync, mkdtempSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import os from 'os';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, '.test-build');
rmSync(out, { recursive: true, force: true }); mkdirSync(out);
const entries = readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.test.ts')).map((f) => path.join(root, 'tests', f));
await build({
  entryPoints: entries, outdir: out, bundle: true, platform: 'node', format: 'cjs', target: 'node16', packages: 'external',
  alias: { '@': path.join(root, 'src') }, logLevel: 'warning',
});
// run inside an empty temp dir so the file store never touches the real .data/
const cwd = mkdtempSync(path.join(os.tmpdir(), 'cv-test-'));
const files = readdirSync(out).filter((f) => f.endsWith('.js')).map((f) => path.join(out, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', cwd, env: { ...process.env, NODE_PATH: path.join(root, 'node_modules'), NEXTAUTH_SECRET: 'test-secret' } });
rmSync(cwd, { recursive: true, force: true });
process.exit(r.status ?? 1);
