import { z } from 'zod';
import { tx, publicUser } from '@/lib/server/db';
import { ok, handle, body } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export const GET = handle(async () => ok({ user: publicUser(await requireUser()) }));

/** Saved payment preference stores only a method + display label (never card numbers). Card tokens come from the gateway. */
const Schema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  paymentPreference: z.object({ method: z.enum(['upi', 'card', 'netbanking', 'wallet']), label: z.string().trim().max(40) }).nullable().optional(),
});
export const PATCH = handle(async (req: Request) => {
  const u = await requireUser();
  const b = await body(req, Schema);
  if (b.paymentPreference?.label && /\d{12,}/.test(b.paymentPreference.label.replace(/\s/g, ''))) b.paymentPreference.label = 'Saved card';
  const user = tx((d) => {
    const me = d.users.find((x) => x.id === u.id)!;
    if (b.name) me.name = b.name;
    if (b.paymentPreference !== undefined) me.paymentPreference = b.paymentPreference;
    return me;
  });
  return ok({ user: publicUser(user) });
});
