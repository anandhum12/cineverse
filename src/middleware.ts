import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * 1. Issues an anonymous, httpOnly seat-holder id (cv_hid) so seat holds work before login
 *    and survive signing in mid-booking.
 * 2. Guards authenticated areas. API routes enforce auth themselves as well (defence in depth).
 */
const PROTECTED = ['/account', '/checkout', '/tickets'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname.startsWith(p));
  const isAdmin = pathname.startsWith('/admin');
  if (needsAuth || isAdmin) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
    if (isAdmin && token.role !== 'admin') return NextResponse.redirect(new URL('/', req.url));
  }

  let hid = req.cookies.get('cv_hid')?.value;
  const fresh = !hid || !/^[a-f0-9-]{36}$/.test(hid);
  if (fresh) hid = crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set('x-cv-holder', hid!);
  const res = NextResponse.next({ request: { headers } });
  if (fresh) res.cookies.set('cv_hid', hid!, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|media/).*)'] };
