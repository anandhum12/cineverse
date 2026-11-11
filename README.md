# CineVerse

A cinema booking platform where you **see the view from your seat before you book it.**

Browse films, find nearby cinemas, pick a showtime, choose seats on an interactive seat map, then step into a **180° preview** of that exact seat. The preview shows the screen size, viewing angle, distance and the seats around you. Pay through Razorpay (or the built-in sandbox) and get a signed QR ticket.

> All films, cinemas and artwork in the seed data are fictional. Posters are generated art. Simulated seat previews are always labelled as simulations. Only photographs an admin uploads and maps to a seat zone are shown as "Real photograph".

---

## Quick start

```bash
npm install
cp .env.example .env.local       # then set NEXTAUTH_SECRET (openssl rand -base64 32)
npm run dev                      # http://localhost:3000
```

No database, Redis or API keys are needed to run locally. Data is seeded into `.data/db.json` on first boot; `npm run reset-data` wipes and reseeds it.

| Account | Email | Password |
|---|---|---|
| Customer | `demo@cineverse.dev` | `demo1234` |
| Admin | `admin@cineverse.dev` | `admin123` |

These demo credentials are for local development only. Change or remove them before any deployment (`src/lib/server/db.ts` → `seed()`).

```bash
npm test          # 14 tests: geometry, pricing, recommendations, seat locks, double-booking race, forged payments
npm run typecheck
npm run build && npm start
```

**Runtime:** written to run on Node 16.14+ (your machine has Node 16.17), which is why it uses **Next.js 13.5.11**, the last line that supports Node 16. Node 16 is end-of-life and Next 13.5 does not receive all current security patches. Before production, move to **Node 20+ and Next 14.2.35+ (or 15)**; see `docs/ARCHITECTURE.md → Upgrading`.

---

## What's implemented

| Area | Where | Notes |
|---|---|---|
| Design system | `tailwind.config.ts`, `src/app/globals.css`, `src/components/ui/*` | Dark glass theme, magnetic buttons, skeletons, toasts, modals, reduced-motion support |
| Homepage | `src/app/page.tsx`, `Hero`, `MovieRail`, `MovieCard` | Rotating hero with parallax, trailer modal, Now Showing / Near You / Trending / Top Rated / Coming Soon / Recommended |
| Location | `LocationGate`, `src/lib/cities.ts` | Geolocation with permission, nearest supported city, manual city/area search, persisted per device |
| Theatre discovery | `ShowtimeExplorer`, `TheatreMap`, `/api/theatres` | Distance-sorted list + Leaflet map (CARTO dark tiles); filters for distance, price, time of day, language, format, rating |
| Movie details | `/movies/[slug]` | Backdrop, cast & crew, rating, trailer, favourites, schema.org JSON-LD; date → cinema → showtime |
| Seat map | `components/booking/SeatMap.tsx` | SVG, curved rows, aisles, walkways, exits, accessible seats; pan, wheel and pinch zoom; hover tooltip with price + view score; keyboard accessible |
| Live availability | `/api/shows/[id]/stream` (SSE) | Push updates on every hold, release, booking or cancellation |
| Seat holds | `src/lib/server/locks.ts` | All-or-nothing holds with expiry; in-memory or Redis (Lua script) |
| **180° seat view** | `components/immersive/*` | React Three Fiber auditorium generated from the screen's geometry; camera at the seat's eye point; drag/touch/keys, pinch/scroll zoom, gyroscope, WebXR; swap seats inside the view; 2D "Lite" fallback; real-photo mode when a panorama is mapped to that zone |
| Seat recommendations | `src/lib/recommend.ts` | Scores contiguous available blocks by FOV, off-axis angle, neck angle, price and aisle access. Seven preferences, party size 1–10 |
| Checkout | `components/checkout/Checkout.tsx` | Itemised GST and fees, hold countdown, UPI/card/netbanking/wallet, retry after failure |
| Payments | `src/lib/server/payments.ts`, `bookings.ts` | Razorpay orders, HMAC verification, gateway re-fetch, webhook, refunds; sandbox gateway when no keys |
| Ticket | `/tickets/[id]` | Signed QR (scanner hits `/api/tickets/verify`), PNG download, print, cancellation with refund |
| Accounts | `/login`, `/register`, `/account` | Email/password + Google (when configured), upcoming/history, favourites, saved payment preference (label only) |
| Admin | `/admin/*` | Revenue dashboard, movies (artwork/trailer upload), theatres, screens, **layout editor** with live preview and 180° check, panoramas → seat zones, showtimes (overlap-checked), bookings, user roles |

## Configuration

All optional except `NEXTAUTH_SECRET`. See `.env.example`.

- **Razorpay:** set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (test keys work). Checkout then opens Razorpay's hosted form. Set `RAZORPAY_WEBHOOK_SECRET` and point a webhook at `/api/payments/webhook` (events `payment.captured`, `payment.failed`) so bookings still confirm if the customer closes the tab.
- **Google sign-in:** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; redirect URI `{NEXTAUTH_URL}/api/auth/callback/google`.
- **Redis:** `REDIS_URL` switches seat locks to Redis, which you need for more than one server instance.
- **Hold length:** `SEAT_HOLD_SECONDS` (default 420). Checkout extends the hold to at least 10 minutes.

## Real theatre panoramas

Admin → Theatres & screens → *Layout & 180°* → **Real theatre panoramas**. Upload an equirectangular 180° or 360° photo taken from a seat, choose the rows and side it represents, and set the yaw offset so the image's forward direction faces the screen. Seats in that zone then open in **Real photograph** mode with the capture date shown. Every other seat uses the simulation, labelled as such.

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
# cineverse
