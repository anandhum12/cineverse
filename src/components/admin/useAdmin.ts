'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { toast } from '@/lib/store';
import { DEMO } from '@/lib/mode';
import { loadDemo } from '@/lib/demo/lazy';

export function useAdmin<T>(resource: string, query = '') {
  const [items, setItems] = useState<T[] | null>(null);
  const load = useCallback(() => api<{ items: T[] }>(`/api/admin/${resource}${query ? `?${query}` : ''}`).then((r) => setItems(r.items)).catch((e) => toast('error', e.message)), [resource, query]);
  useEffect(() => { load(); }, [load]);
  const save = async (id: string | null, data: unknown) => {
    try {
      await api(`/api/admin/${resource}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', json: data });
      toast('success', 'Saved.'); await load(); return true;
    } catch (e) {
      const err = e as Error & { details?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> } };
      const extra = [...(err.details?.formErrors ?? []), ...Object.entries(err.details?.fieldErrors ?? {}).map(([k, v]) => `${k}: ${v[0]}`)].slice(0, 3).join(' · ');
      toast('error', extra ? `${err.message}: ${extra}` : err.message); return false;
    }
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    try { await api(`/api/admin/${resource}/${id}`, { method: 'DELETE' }); toast('success', 'Deleted.'); load(); } catch (e) { toast('error', (e as Error).message); }
  };
  return { items, load, save, remove };
}

export async function upload(file: File): Promise<string | null> {
  if (DEMO) { try { return await (await loadDemo()).demo.upload(file); } catch (e) { toast('error', (e as Error).message); return null; } }
  const fd = new FormData(); fd.append('file', file);
  const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { toast('error', j.error || 'Upload failed'); return null; }
  return j.url;
}
