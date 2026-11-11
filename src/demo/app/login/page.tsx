'use client';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
export default function DemoLogin() { return <Suspense><AuthForm mode="login" google={false} /></Suspense>; }
