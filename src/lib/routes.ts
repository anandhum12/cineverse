import { DEMO } from './mode';

/**
 * App URLs. The server build uses path segments; the static Pages demo can't serve arbitrary
 * dynamic paths, so it uses query strings on pre-built pages instead.
 */
export const routes = {
  movie: (slug: string, hash = '') => (DEMO ? `/movie/?m=${encodeURIComponent(slug)}${hash}` : `/movies/${slug}${hash}`),
  book: (showId: string) => (DEMO ? `/book/?show=${encodeURIComponent(showId)}` : `/book/${showId}`),
  checkout: (id: string) => (DEMO ? `/checkout/?id=${encodeURIComponent(id)}` : `/checkout/${id}`),
  ticket: (id: string, fresh = false) => (DEMO ? `/tickets/?id=${encodeURIComponent(id)}${fresh ? '&new=1' : ''}` : `/tickets/${id}${fresh ? '?new=1' : ''}`),
  adminScreen: (id: string) => (DEMO ? `/admin/screen/?id=${encodeURIComponent(id)}` : `/admin/screens/${id}`),
  login: (next: string) => `/login${DEMO ? '/' : ''}?next=${encodeURIComponent(next)}`,
};
