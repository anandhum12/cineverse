import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import type { ZodSchema } from 'zod';

import { HttpError } from './errors';
export { HttpError };

export const ok = <T>(data: T, init?: number) => NextResponse.json(data, { status: init ?? 200 });

export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
  console.error('[api]', e);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}

/** Wrap a route handler body with uniform error handling. */
export function handle<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A) => { try { return await fn(...a); } catch (e) { return fail(e); } };
}

export async function body<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw new HttpError(400, 'Request body must be JSON'); }
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(422, 'Invalid input', r.error.flatten());
  return r.data;
}

/** Anonymous seat-holder id; set by middleware so holds survive login. */
export function holderId(): string {
  return headers().get('x-cv-holder') || cookies().get('cv_hid')?.value || 'anon';
}
