import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getUser, getUserByEmail, tx, uid } from './db';
import { HttpError } from './errors';
import type { Role } from '../types';

const providers: NextAuthOptions['providers'] = [
  Credentials({
    name: 'Email',
    credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' } },
    async authorize(creds) {
      const p = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(creds);
      if (!p.success) return null;
      const u = getUserByEmail(p.data.email);
      if (!u?.passwordHash || !(await bcrypt.compare(p.data.password, u.passwordHash))) return null;
      return { id: u.id, email: u.email, name: u.name, image: u.image ?? null };
    },
  }),
];
export const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
if (googleEnabled) providers.push(Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }));

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 3600 },
  pages: { signIn: '/login' },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        if (!getUserByEmail(user.email))
          tx((d) => d.users.push({ id: uid('u'), email: user.email!, name: user.name || user.email!, image: user.image, role: 'user', provider: 'google', favourites: [], createdAt: new Date().toISOString() }));
      }
      return true;
    },
    async jwt({ token }) {
      const u = token.email ? getUserByEmail(token.email) : undefined;
      if (u) { token.uid = u.id; token.role = u.role; }
      return token;
    },
    async session({ session, token }) {
      if (session.user) Object.assign(session.user, { id: token.uid, role: token.role });
      return session;
    },
  },
};

export async function sessionUser() {
  const s = await getServerSession(authOptions);
  const id = (s?.user as { id?: string } | undefined)?.id;
  return id ? getUser(id) ?? null : null;
}

export async function requireUser() {
  const u = await sessionUser();
  if (!u) throw new HttpError(401, 'Please sign in to continue.');
  return u;
}

export async function requireRole(role: Role) {
  const u = await requireUser();
  if (u.role !== role) throw new HttpError(403, 'You do not have access to this area.');
  return u;
}
