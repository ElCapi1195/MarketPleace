'use client';

import type { Overview } from '@marketplace/contracts';
import Link from 'next/link';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { overviewTiles } from '../lib/overview';

export function OverviewPanel() {
  const { result } = useResource<Overview>('/api/admin/overview');
  return (
    <ResourceGate result={result}>
      {(overview) => (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {overviewTiles(overview).map(({ label, count, href }) => (
            <li key={label}>
              <Link href={href} className={`group flex min-h-32 flex-col justify-between rounded-3xl p-5 ${count > 0 ? 'bg-accent text-ink' : 'bg-surface'}`}>
                <span className="font-display text-5xl font-extrabold">{count}</span>
                <span className="text-lg font-bold group-hover:underline">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ResourceGate>
  );
}
