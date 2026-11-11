'use client';
import type { ReactNode } from 'react';
export function PageHead({ title, children, sub }: { title: string; sub?: string; children?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>{sub && <p className="mt-1 text-sm text-white/50">{sub}</p>}</div><div className="flex flex-wrap gap-2">{children}</div></div>;
}
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead><tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/40">{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
      </table>
    </div>
  );
}
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className ?? ''}`}><span className="label">{label}</span>{children}</label>;
}
