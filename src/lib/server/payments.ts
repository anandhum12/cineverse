import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

/**
 * Payment gateway abstraction.
 *  - Razorpay (live/test keys) when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set.
 *  - Sandbox gateway otherwise: a server-side simulator that issues order ids, payment ids and
 *    HMAC signatures exactly like Razorpay, so the same verification path is exercised.
 *    It is refused in production unless ALLOW_SANDBOX_PAYMENTS=true.
 *
 * A booking is only confirmed after `verifySignature()` passes on the server AND (for Razorpay)
 * the payment is fetched from the Razorpay API and found captured/authorized for the right amount.
 */
const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
export const provider: 'razorpay' | 'sandbox' = KEY_ID && KEY_SECRET ? 'razorpay' : 'sandbox';

type G = typeof globalThis & { __cv_sbx?: string };
const sandboxSecret = () => ((globalThis as G).__cv_sbx ??= process.env.NEXTAUTH_SECRET || randomBytes(32).toString('hex'));
const secret = () => (provider === 'razorpay' ? KEY_SECRET : sandboxSecret());

export function sandboxAllowed() {
  return provider === 'sandbox' && (process.env.NODE_ENV !== 'production' || process.env.ALLOW_SANDBOX_PAYMENTS === 'true');
}

const auth = () => 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');

export async function createOrder(amountPaise: number, receipt: string): Promise<{ orderId: string; keyId: string | null }> {
  if (provider === 'razorpay') {
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, payment_capture: 1 }),
    });
    if (!r.ok) throw new Error(`Razorpay order failed: ${r.status} ${await r.text()}`);
    const j = (await r.json()) as { id: string };
    return { orderId: j.id, keyId: KEY_ID };
  }
  if (!sandboxAllowed()) throw new Error('No payment gateway configured');
  return { orderId: `order_sbx_${randomBytes(8).toString('hex')}`, keyId: null };
}

export const sign = (orderId: string, paymentId: string) => createHmac('sha256', secret()).update(`${orderId}|${paymentId}`).digest('hex');

export function verifySignature(orderId: string, paymentId: string, signature: string) {
  const a = Buffer.from(sign(orderId, paymentId));
  const b = Buffer.from(signature || '');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Second, independent check against the gateway (Razorpay only). */
export async function fetchPayment(paymentId: string): Promise<{ status: string; amount: number; order_id: string; method?: string } | null> {
  if (provider !== 'razorpay') return null;
  const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: auth() } });
  if (!r.ok) throw new Error(`Razorpay fetch failed: ${r.status}`);
  return r.json();
}

export async function refund(paymentId: string, amountPaise: number): Promise<{ id: string; status: 'initiated' | 'processed' }> {
  if (provider === 'razorpay') {
    const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST', headers: { Authorization: auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amountPaise }),
    });
    if (!r.ok) throw new Error(`Razorpay refund failed: ${r.status}`);
    const j = (await r.json()) as { id: string; status: string };
    return { id: j.id, status: j.status === 'processed' ? 'processed' : 'initiated' };
  }
  return { id: `rfnd_sbx_${randomBytes(6).toString('hex')}`, status: 'processed' };
}

export function verifyWebhook(rawBody: string, signature: string | null) {
  const s = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!s || !signature) return false;
  const exp = Buffer.from(createHmac('sha256', s).update(rawBody).digest('hex'));
  const got = Buffer.from(signature);
  return exp.length === got.length && timingSafeEqual(exp, got);
}

/** Sandbox gateway: simulate the customer completing (or failing) payment. */
export function sandboxCharge(orderId: string, outcome: 'success' | 'failure') {
  if (!sandboxAllowed()) throw new Error('Sandbox payments are disabled');
  if (!orderId.startsWith('order_sbx_')) throw new Error('Not a sandbox order');
  if (outcome === 'failure') return { ok: false as const, error: 'Payment declined by bank (sandbox)' };
  const paymentId = `pay_sbx_${randomBytes(8).toString('hex')}`;
  return { ok: true as const, paymentId, signature: sign(orderId, paymentId) };
}

// ─── Ticket QR tokens ───────────────────────────────────────────────────────
const ticketSecret = () => process.env.TICKET_SIGNING_SECRET || process.env.NEXTAUTH_SECRET || sandboxSecret();
export const ticketToken = (bookingId: string) => createHmac('sha256', ticketSecret()).update(`ticket:${bookingId}`).digest('base64url').slice(0, 22);
export function verifyTicketToken(bookingId: string, token: string) {
  const a = Buffer.from(ticketToken(bookingId));
  const b = Buffer.from(token || '');
  return a.length === b.length && timingSafeEqual(a, b);
}
