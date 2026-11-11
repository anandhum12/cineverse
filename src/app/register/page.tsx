import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { googleEnabled } from '@/lib/server/auth';
export const metadata = { title: 'Create account' };
export default function Register() { return <Suspense><AuthForm mode="register" google={googleEnabled} /></Suspense>; }
