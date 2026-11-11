/** Loads the in-browser demo backend on demand, so server builds never ship it to visitors. */
type Mod = typeof import('./backend');
let mod: Mod | null = null;
let pending: Promise<Mod> | null = null;
export function loadDemo(): Promise<Mod> {
  return (pending ??= import('./backend').then((m) => (mod = m)));
}
export const loadedDemo = () => mod?.demo ?? null;
