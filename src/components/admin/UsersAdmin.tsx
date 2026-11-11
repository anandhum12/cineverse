'use client';
import type { User } from '@/lib/types';
import { useAdmin } from './useAdmin';
import { PageHead, Table } from './ui';
import { Skeleton } from '../ui/misc';
import { fmtDate } from '@/lib/format';

export function UsersAdmin() {
  const { items, save } = useAdmin<Omit<User, 'passwordHash'>>('users');
  return (
    <div>
      <PageHead title="Users" />
      {!items ? <Skeleton className="h-96" /> : (
        <Table head={['Name', 'Email', 'Sign-in', 'Joined', 'Favourites', 'Role']}>
          {items.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2">{u.name}</td><td className="px-4 py-2 text-white/60">{u.email}</td>
              <td className="px-4 py-2 text-white/60 capitalize">{u.provider}</td><td className="px-4 py-2 text-white/60">{fmtDate(u.createdAt)}</td>
              <td className="px-4 py-2 text-white/60">{u.favourites.length}</td>
              <td className="px-4 py-2"><select className="input !w-28 !py-1.5" value={u.role} onChange={(e) => save(u.id, { role: e.target.value })} aria-label={`Role for ${u.email}`}><option value="user">User</option><option value="admin">Admin</option></select></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
