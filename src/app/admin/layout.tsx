import { redirect } from 'next/navigation';
import { sessionUser } from '@/lib/server/auth';
import { AdminNav } from '@/components/admin/AdminNav';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await sessionUser();
  if (!u || u.role !== 'admin') redirect('/login?next=/admin');
  return (
    <div className="flex min-h-screen">
      <AdminNav name={u.name} />
      <div className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-8 lg:pt-8">{children}</div>
    </div>
  );
}
