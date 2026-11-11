'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface UserLocation { mode: 'gps' | 'manual'; cityId: string; label: string; lat: number; lng: number }

interface LocationState {
  location: UserLocation | null;
  prompted: boolean;
  pickerOpen: boolean;
  set: (l: UserLocation) => void;
  setPrompted: (v: boolean) => void;
  openPicker: (v: boolean) => void;
}

const safeStorage = createJSONStorage(() => {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; }
  catch { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; }
});

export const useLocation = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      prompted: false,
      pickerOpen: false,
      set: (location) => set({ location, prompted: true, pickerOpen: false }),
      setPrompted: (prompted) => set({ prompted }),
      openPicker: (pickerOpen) => set({ pickerOpen }),
    }),
    { name: 'cv-location', storage: safeStorage, partialize: (s) => ({ location: s.location, prompted: s.prompted }), skipHydration: true },
  ),
);

/** Seat-selection UI state for the active show. Server is the source of truth for holds. */
interface SeatUI {
  showId: string | null;
  selected: string[];
  focused: string | null;
  previewSeat: string | null;
  highlight: string[];       // recommended seats
  holdExpiresAt: number | null;
  reset: (showId: string) => void;
  setSelected: (ids: string[]) => void;
  focus: (id: string | null) => void;
  preview: (id: string | null) => void;
  setHighlight: (ids: string[]) => void;
  setHold: (t: number | null) => void;
}
export const useSeatUI = create<SeatUI>((set) => ({
  showId: null, selected: [], focused: null, previewSeat: null, highlight: [], holdExpiresAt: null,
  reset: (showId) => set({ showId, selected: [], focused: null, previewSeat: null, highlight: [], holdExpiresAt: null }),
  setSelected: (selected) => set({ selected }),
  focus: (focused) => set({ focused }),
  preview: (previewSeat) => set({ previewSeat }),
  setHighlight: (highlight) => set({ highlight }),
  setHold: (holdExpiresAt) => set({ holdExpiresAt }),
}));

interface Toast { id: number; kind: 'info' | 'error' | 'success'; text: string }
export const useToasts = create<{ toasts: Toast[]; push: (kind: Toast['kind'], text: string) => void; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  push: (kind, text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
export const toast = (kind: Toast['kind'], text: string) => useToasts.getState().push(kind, text);
