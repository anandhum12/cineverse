import { getShow } from '@/lib/server/db';
import { holderId } from '@/lib/server/http';
import { bus } from '@/lib/server/locks';
import { seatStates } from '@/lib/server/seats';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events stream of live seat states for a show.
 * Pushes on every hold/release/booking change, plus a 15s heartbeat (which also surfaces lock expiries).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!getShow(params.id)) return new Response('Not found', { status: 404 });
  const hid = holderId();
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    async start(controller) {
      let last = '';
      let closed = false;
      const send = async () => {
        if (closed) return;
        try {
          const s = JSON.stringify(await seatStates(params.id, hid));
          if (s !== last) { last = s; controller.enqueue(enc.encode(`event: seats\ndata: ${s}\n\n`)); }
          else controller.enqueue(enc.encode(`: ping\n\n`));
        } catch { /* stream closed */ }
      };
      let pending: NodeJS.Timeout | null = null;
      const onChange = () => { if (!pending) pending = setTimeout(() => { pending = null; send(); }, 60); };
      bus().on(`show:${params.id}`, onChange);
      const beat = setInterval(send, 15_000);
      cleanup = () => { closed = true; clearInterval(beat); if (pending) clearTimeout(pending); bus().off(`show:${params.id}`, onChange); };
      req.signal.addEventListener('abort', () => { cleanup(); try { controller.close(); } catch {} });
      controller.enqueue(enc.encode('retry: 3000\n\n'));
      await send();
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
