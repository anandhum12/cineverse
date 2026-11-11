// Serves ./out under the same base path GitHub Pages uses, for checking the demo locally.
// Usage: NEXT_PUBLIC_BASE_PATH=/cineverse npm run preview:pages
import http from 'http';
import { createReadStream, existsSync, statSync } from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'out');
const base = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const port = Number(process.env.PORT || 4000);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (base && !p.startsWith(base)) { res.writeHead(302, { Location: base + '/' }); return res.end(); }
  p = path.join(root, p.slice(base.length));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404, { 'Content-Type': 'text/html' }); return createReadStream(path.join(root, '404.html')).pipe(res); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  createReadStream(p).pipe(res);
}).listen(port, () => console.log(`Pages preview: http://localhost:${port}${base}/`));
