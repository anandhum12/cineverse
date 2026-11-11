'use client';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
export default function DemoRegister() { return <Suspense><AuthForm mode="register" google={false} /></Suspense>; }
