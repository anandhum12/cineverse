import { ok, handle } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { cancelBooking } from '@/lib/server/bookings';
export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const u = await requireUser();
  const b = await cancelBooking(params.id, u.id);
  return ok({ booking: b });
});
