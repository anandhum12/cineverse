import fs from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '@/lib/server/storage';
const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4' };
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  if (!/^[a-z0-9-]+\.(jpg|png|webp|mp4)$/.test(params.file)) return new Response('Not found', { status: 404 });
  const p = path.join(UPLOAD_DIR, params.file);
  if (!fs.existsSync(p)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(p), { headers: { 'Content-Type': TYPES[params.file.split('.').pop()!], 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
