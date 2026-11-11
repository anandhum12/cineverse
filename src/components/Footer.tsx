'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export function Footer() {
  const p = usePathname();
  if (p?.startsWith('/admin') || p?.startsWith('/book/')) return null;
  return (
    <footer className="no-print mt-24 border-t border-white/[0.06]">
      <div className="container-x flex flex-col gap-6 py-10 text-sm text-white/40 md:flex-row md:items-center md:justify-between">
        <div><span className="font-display text-base font-bold text-white/80">CineVerse</span><p className="mt-1 max-w-md text-xs">Films, cinemas and artwork shown here are fictional demo content. Simulated seat previews are computed from theatre geometry and are always labelled as such.</p></div>
        <nav className="flex gap-6"><Link href="/movies" className="hover:text-white">Movies</Link><Link href="/theatres" className="hover:text-white">Cinemas</Link><Link href="/account" className="hover:text-white">My tickets</Link></nav>
      </div>
    </footer>
  );
}
