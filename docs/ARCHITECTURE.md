# CineVerse architecture

## Shape of the system

```
Browser ──► Next.js (App Router)
            ├─ Server components: pages read the store directly
            ├─ Route handlers /api/*: REST + SSE, zod-validated, role-checked
            ├─ middleware.ts: anonymous seat-holder cookie, auth guards
            └─ src/lib/server/*
                 db.ts        file-backed document store (atomic tx)      ─► PostgreSQL (prisma/schema.prisma)
                 locks.ts     seat holds with expiry                       ─► Redis when REDIS_URL is set
                 seats.ts     seat-state projection + change events
                 bookings.ts  pending → verify → confirm/refund
                 payments.ts  Razorpay / sandbox gateway, HMAC, QR tokens
                 catalog.ts   location-aware theatre & showtime listings
            src/lib/ (shared, isomorphic)
                 geometry.ts  seat coordinates + view metrics (one source of truth for map, 3D, scores)
                 recommend.ts geometry-based seat recommendations
                 pricing.ts   GST + fees
```

## Theatre geometry: one model, four uses

`computeSeats(layout)` places every seat in metres. The origin is the screen's bottom-centre, +z runs toward the rear, rows are curved and raked, recliner rows are deeper, and walkways add depth. `viewMetrics(seat)` derives:

- distance to the screen centre
- horizontal field of view the screen fills
- off-axis angle
- look-up angle to the top edge (neck strain)
- a 0–100 score (THX/SMPTE-style band of 34–52° FOV, on-axis, low neck strain)

The same numbers drive the SVG seat map, the hover tooltips, the recommender, the 3D camera position and the 180° HUD, so they cannot disagree.

## Booking correctness

Invariant: **no seat is ever in two confirmed bookings for the same show, nor in a confirmed booking and a box-office sale.**

1. **Hold.** `POST /api/shows/:id/hold` sets the visitor's holds to exactly the requested seats, all or nothing. Seats already sold, held by someone else, or attached to someone else's pending booking are refused (409). Holds expire.
2. **Pending booking.** `POST /api/bookings` requires sign-in. It reads the visitor's live holds, re-checks them, prices them server-side, extends the hold for payment, and creates a gateway order. Client-supplied prices are never trusted.
3. **Verify and confirm.** `POST /api/payments/verify` checks the HMAC signature (`order_id|payment_id`). With Razorpay it also re-fetches the payment and checks status, amount and order. Then, inside one atomic `tx()`, it re-checks seat occupancy and confirms. If the seats were lost (for example, the hold expired mid-payment and someone else confirmed first), the booking is marked failed and **refunded automatically**. Replays are idempotent.
4. **Webhook.** `payment.captured` runs the same confirmation, which covers customers who close the tab after paying.

`tests/booking.test.ts` races two paid bookings for the same seat and asserts that exactly one confirms and the other is refunded.

The frontend never marks a booking confirmed. The ticket page only renders a QR code for `confirmed` bookings, and the QR carries an HMAC token that `/api/tickets/verify` checks.

### Why the file store is safe, and where it stops

`tx()` runs synchronously on Node's single thread, so a check-then-write cannot interleave with another request. Writes go to a temp file followed by an atomic rename. This is correct for **one server process** only. Running several instances, or serverless platforms like Vercel where each lambda has its own memory and filesystem, needs PostgreSQL and Redis.

## Moving to PostgreSQL (not yet implemented)

`prisma/schema.prisma` is the target schema. The double-booking guard there is `BookingSeat @@unique([showId, seatLabel])`, with rows inserted in the confirmation transaction; a concurrent confirm fails with a unique violation, which maps to the auto-refund branch. Showtime overlap becomes a GiST exclusion constraint. Steps:

1. `npm i -D prisma && npm i @prisma/client`, set `DATABASE_URL`, `npx prisma migrate dev`.
2. Re-implement the functions exported from `src/lib/server/db.ts` (`db`, `tx`, the getters and `occupiedSeats`) on Prisma. `tx` becomes `prisma.$transaction(..., { isolationLevel: 'Serializable' })`.
3. Write a seed script from `src/lib/server/seed.ts`.
4. Set `REDIS_URL`, and replace the `EventEmitter` in `locks.ts → bus()` with Redis pub/sub so SSE fans out across instances.

## Real time

Seat changes emit `show:{id}` on an in-process bus. `/api/shows/:id/stream` (Server-Sent Events) pushes the full seat-state map after each change, debounced to 60 ms, plus a 15-second heartbeat that also surfaces expired holds. SSE was chosen over WebSockets because Next.js route handlers support it natively and the traffic is one-way. On the client, `EventSource` reconnects automatically.

## 180° preview

- **Simulated mode** (`TheatreScene.tsx`): the room is built from the layout. That covers raked risers, side walls with acoustic panels and sconces, a star ceiling, exits with signs, aisle step lights, and instanced seats coloured by category and state. Sold seats get audience heads, because heads in front of you matter. The screen is a light source showing the film's key art. The world is offset so the viewer's eye sits at the origin, which keeps the regular camera and WebXR head pose correct. Changing seats animates the offset.
- **Real mode** (`PanoramaSphere`): an uploaded equirectangular image on an inside-out sphere (half sphere for 180°). It is chosen per seat by row and side zone.
- **Controls:** drag or touch to look (clamped to ±90° around the screen direction), pinch or wheel for FOV, arrow keys, gyroscope (with the iOS permission prompt), WebXR "Enter VR" where supported.
- **Low-power devices:** quality drops automatically (DPR, lights, ceiling detail). Without WebGL it falls back to the **Lite view**, a 2D canvas pinhole projection of the same geometry.
- **Labelling:** every preview shows either "Simulated preview: computed from theatre geometry, not a photograph" or "Real photograph · captured <date>".

## Security notes

- Inputs are zod-validated on every mutating route. Admin routes call `requireRole('admin')`, and middleware also guards `/admin`.
- Passwords use bcrypt (cost 11). Sessions are NextAuth JWTs signed with `NEXTAUTH_SECRET`. The login `next` parameter is restricted to same-site paths.
- Payment signature and QR token comparisons are timing-safe. The sandbox gateway is refused in production unless explicitly enabled.
- Uploads are limited to images and MP4 by MIME type and magic bytes, capped at 25 MB, and given random names.
- Security headers are set in `next.config.js`. No card data is stored; the saved payment preference is a method plus a label.
- **Not yet done:** rate limiting on login, registration and hold endpoints (add at the edge or with Redis), email verification, CSRF tokens on the JSON APIs (they currently rely on SameSite=Lax cookies plus JSON content types), and a CSP header.

## Upgrading (recommended before production)

Node 16 is end-of-life. On Node 20+:

```bash
npm i next@14.2.35
```

The code uses only the stable App Router APIs common to 13.5 and 14. `metadata.viewport`/`themeColor` would move to `export const viewport`.

## Deployment

- **Single VM or container (works today):** `npm ci && npm run build && npm start` behind a reverse proxy. Persist `.data/` on a volume. Disable proxy buffering for `/api/shows/*/stream`.
- **Vercel + managed Postgres/Redis:** requires the PostgreSQL adapter above, Redis locks and pub/sub, and S3 or Cloudinary uploads (`src/lib/server/storage.ts → put`), because the local filesystem is ephemeral there.
