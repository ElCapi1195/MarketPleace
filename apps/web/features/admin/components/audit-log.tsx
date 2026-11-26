'use client';

import type { AuditItem } from '@marketplace/contracts';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { SelectField, TextField } from '@/features/shared/components/fields';
import { apiMessage } from '@/features/shared/lib/messages';
import { get } from '@/lib/client-api';
import { actionFilters, auditQuery, describeAction } from '../lib/audit';

interface Page {
  items: AuditItem[];
  nextCursor: string | null;
}

export function AuditLog({ locale, initialTarget }: { locale: string; initialTarget: string }) {
  const [filters, setFilters] = useState({ action: '', actorId: '', targetId: initialTarget });
  const [applied, setApplied] = useState(filters);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' });

  const load = useCallback(async (from: string | null, current: typeof applied) => {
    const result = await get<Page>(`/api/admin/audit?${auditQuery(current, from)}`);
    if (!result.ok) {
      if (result.status === 401) window.location.replace('/entrar?siguiente=/admin/auditoria');
      return setError(result.code === 'TWO_FACTOR_REQUIRED' ? 'Activa el segundo paso en tu cuenta.' : apiMessage(result));
    }
    setError(null);
    setItems((previous) => (from ? [...previous, ...result.data.items] : result.data.items));
    setCursor(result.data.nextCursor);
  }, []);

  useEffect(() => {
    void load(null, applied);
  }, [applied, load]);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setApplied(filters);
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={apply} className="grid items-end gap-4 sm:grid-cols-4">
        <SelectField label="Tipo" value={filters.action} onChange={(action) => setFilters({ ...filters, action })} options={actionFilters} />
        <TextField label="Autor (id)" value={filters.actorId} onChange={(actorId) => setFilters({ ...filters, actorId })} maxLength={60} />
        <TextField label="Objeto (id)" value={filters.targetId} onChange={(targetId) => setFilters({ ...filters, targetId })} maxLength={60} />
        <button type="submit" className="h-12 cursor-pointer rounded-xl bg-ink px-5 font-bold text-background">
          Filtrar
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <ul>
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b-2 border-surface py-3">
            <div className="min-w-56 flex-1">
              <p className="font-bold">{describeAction(item.action)}</p>
              <p className="text-sm break-all">
                {item.actor ? `${item.actor.name} (${item.actor.email})` : (item.actorId ?? 'Sistema')}
                {item.targetType && ` → ${item.targetType} ${item.targetId ?? ''}`}
              </p>
            </div>
            <time dateTime={item.at} className="text-sm">
              {format.format(new Date(item.at))}
            </time>
          </li>
        ))}
      </ul>
      {items.length === 0 && !error && <p>No hay registros con esos filtros.</p>}
      {cursor && (
        <button type="button" onClick={() => load(cursor, applied)} className="min-h-12 cursor-pointer self-start rounded-xl border-2 border-ink px-5 font-bold">
          Cargar más
        </button>
      )}
    </div>
  );
}
