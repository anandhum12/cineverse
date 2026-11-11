'use client';
import { DEMO } from './mode';
import { loadDemo } from './demo/lazy';

export class ApiError extends Error { constructor(public status: number, message: string, public details?: unknown) { super(message); } }

/** JSON API call. In the Pages demo the same request is answered by the in-browser backend. */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  if (DEMO) {
    const { demo, DemoError } = await loadDemo();
    try { return (await demo.request(rest.method || 'GET', url, json)) as T; }
    catch (e) { if (e instanceof DemoError) throw new ApiError(e.status, e.message, e.details); throw e; }
  }
  const r = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers || {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: 'no-store',
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (data as { error?: string }).error || `Request failed (${r.status})`, (data as { details?: unknown }).details);
  return data as T;
}

/** Live seat states: Server-Sent Events on the server build, store subscription in the demo. */
export function subscribeSeats(showId: string, onStates: (s: Record<string, string>) => void, onLive: (live: boolean) => void): () => void {
  if (DEMO) {
    let off = () => {};
    let live = true;
    const pull = () => api<{ states: Record<string, string> }>(`/api/shows/${showId}`).then((r) => live && onStates(r.states)).catch(() => {});
    loadDemo().then((m) => { if (!live) return; off = m.demo.subscribe(pull); onLive(true); });
    const t = setInterval(pull, 15_000); // surfaces expired holds
    return () => { live = false; off(); clearInterval(t); };
  }
  const es = new EventSource(`/api/shows/${showId}/stream`);
  es.addEventListener('seats', (e) => { onStates(JSON.parse((e as MessageEvent).data)); onLive(true); });
  es.onerror = () => onLive(false);
  return () => es.close();
}
