import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

/**
 * Upload storage. Local driver writes to .data/uploads and serves via /media/[file].
 * For S3/Cloudinary, implement `put` with the same signature and return the public URL.
 */
export const UPLOAD_DIR = path.join(process.cwd(), '.data', 'uploads');
export const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4' };
export const MAX_BYTES = 25 * 1024 * 1024;

export async function put(file: File): Promise<string> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error('Only JPEG, PNG, WebP images or MP4 video are allowed');
  if (file.size > MAX_BYTES) throw new Error('File is larger than 25 MB');
  const buf = Buffer.from(await file.arrayBuffer());
  // magic-byte sniffing so a renamed file cannot masquerade as an image
  const sig = buf.subarray(0, 12).toString('hex');
  const okSig = (ext === 'jpg' && sig.startsWith('ffd8ff')) || (ext === 'png' && sig.startsWith('89504e47')) ||
    (ext === 'webp' && sig.startsWith('52494646') && buf.subarray(8, 12).toString() === 'WEBP') || (ext === 'mp4' && buf.subarray(4, 8).toString() === 'ftyp');
  if (!okSig) throw new Error('File content does not match its type');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/media/${name}`;
}
