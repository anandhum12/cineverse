import { ok, handle, HttpError } from '@/lib/server/http';
import { requireRole } from '@/lib/server/auth';
import { put } from '@/lib/server/storage';
export const POST = handle(async (req: Request) => {
  await requireRole('admin');
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw new HttpError(422, 'Attach a file in the "file" field');
  try { return ok({ url: await put(file as File) }, 201); } catch (e) { throw new HttpError(422, (e as Error).message); }
});
