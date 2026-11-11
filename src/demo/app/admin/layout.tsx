'use client';
import { Suspense } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import { PageSkeleton, RequireUser } from '@/lib/demo/hooks';
import { useAppSession } from '@/lib/session';
function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAppSession();
  return <div className="flex min-h-screen"><AdminNav name={user?.name ?? ''} /><div className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-8 lg:pt-8">{children}</div></div>;
}
export default function DemoAdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}><RequireUser admin><Shell>{children}</Shell></RequireUser></Suspense>;
}
