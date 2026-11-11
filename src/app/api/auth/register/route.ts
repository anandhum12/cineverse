import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getUserByEmail, tx, uid, publicUser } from '@/lib/server/db';
import { ok, handle, body, HttpError } from '@/lib/server/http';

const Schema = z.object({ name: z.string().trim().min(2).max(60), email: z.string().trim().toLowerCase().email().max(120), password: z.string().min(8).max(128) });

export const POST = handle(async (req: Request) => {
  const { name, email, password } = await body(req, Schema);
  if (getUserByEmail(email)) throw new HttpError(409, 'An account with this email already exists.');
  const passwordHash = await bcrypt.hash(password, 11);
  const user = tx((d) => {
    if (d.users.some((u) => u.email === email)) throw new HttpError(409, 'An account with this email already exists.');
    const u = { id: uid('u'), email, name, passwordHash, role: 'user' as const, provider: 'credentials' as const, favourites: [], createdAt: new Date().toISOString() };
    d.users.push(u);
    return u;
  });
  return ok({ user: publicUser(user) }, 201);
});
