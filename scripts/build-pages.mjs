// Builds the static GitHub Pages demo into ./out
//
// The server app (src/app) uses API routes, middleware and server components, none of which can run
// on GitHub Pages. This script assembles a separate app tree in .pages-build/: the shared layout plus
// the client-only routes in src/demo/app, backed by the in-browser store (src/lib/demo/backend.ts).
// Usage: NEXT_PUBLIC_BASE_PATH=/cineverse node scripts/build-pages.mjs
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync, renameSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = path.join(root, '.pages-build');
const out = path.join(root, 'out');

rmSync(work, { recursive: true, force: true });
mkdirSync(work);
for (const f of ['package.json', 'next.config.js', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.js', 'next-env.d.ts', 'public'])
  cpSync(path.join(root, f), path.join(work, f), { recursive: true });
symlinkSync(path.join(root, 'node_modules'), path.join(work, 'node_modules'), 'dir');

// src without the server routes and middleware
cpSync(path.join(root, 'src'), path.join(work, 'src'), {
  recursive: true,
  filter: (p) => !p.startsWith(path.join(root, 'src', 'app')) && p !== path.join(root, 'src', 'middleware.ts'),
});
const app = path.join(work, 'src', 'app');
cpSync(path.join(root, 'src', 'demo', 'app'), app, { recursive: true });
for (const f of ['layout.tsx', 'globals.css', 'icon.svg']) cpSync(path.join(root, 'src', 'app', f), path.join(app, f));
rmSync(path.join(app, 'README.md'), { force: true });

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const env = { ...process.env, PAGES_BUILD: '1', NEXT_PUBLIC_DEMO: '1', NEXT_PUBLIC_BASE_PATH: basePath, NEXT_TELEMETRY_DISABLED: '1' };
console.log(`Building Pages demo (basePath "${basePath || '/'}")…`);
const r = spawnSync(process.execPath, [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], { cwd: work, env, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

rmSync(out, { recursive: true, force: true });
renameSync(path.join(work, 'out'), out);
writeFileSync(path.join(out, '.nojekyll'), ''); // serve the _next/ folder as-is
// GitHub Pages serves 404.html for unknown paths
if (existsSync(path.join(out, '404', 'index.html'))) cpSync(path.join(out, '404', 'index.html'), path.join(out, '404.html'));
rmSync(work, { recursive: true, force: true });
console.log(`Done → ${out}`);
