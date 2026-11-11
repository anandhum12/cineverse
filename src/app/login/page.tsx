import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { googleEnabled } from '@/lib/server/auth';
export const metadata = { title: 'Sign in' };
export default function Login() { return <Suspense><AuthForm mode="login" google={googleEnabled} /></Suspense>; }
