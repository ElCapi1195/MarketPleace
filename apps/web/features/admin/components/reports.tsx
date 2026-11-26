'use client';

import type { ReportDetail, ReportPage } from '@marketplace/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { SelectField, TextArea } from '@/features/shared/components/fields';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { Pager } from '@/features/reservations/components/my-reservations';
import { post } from '@/lib/client-api';
import { reportReasonLabel, reportStatusLabel } from '../lib/reports';

export function ReportList({ locale }: { locale: string }) {
  const [status, setStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const { result } = useResource<ReportPage>(`/api/admin/reports?page=${page}${status ? `&status=${status}` : ''}`);
  return (
    <>
      <div className="max-w-64">
        <SelectField
          label="Mostrar"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          placeholder="Todas"
          options={(['OPEN', 'RESOLVED', 'DISMISSED'] as const).map((value) => ({ value, label: reportStatusLabel(value) }))}
        />
      </div>
      <ResourceGate result={result}>
        {({ items, hasMore }) => (
          <>
            {items.length === 0 && <p className="text-lg">No hay denuncias aquí.</p>}
            <ul>
              {items.map((item) => (
                <li key={item.id} className="group relative flex flex-wrap items-baseline justify-between gap-x-4 border-b-2 border-surface py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/denuncias/${item.id}`} className="block font-bold after:absolute after:inset-0 group-hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-sm">{reportReasonLabel(item.reason)}</p>
                  </div>
                  <span>
                    {reportStatusLabel(item.status)}, {new Date(item.createdAt).toLocaleDateString(locale)}
                  </span>
                </li>
              ))}
            </ul>
            <Pager page={page} hasMore={hasMore} onChange={setPage} />
          </>
        )}
      </ResourceGate>
    </>
  );
}

function Resolve({ report, onChange }: { report: ReportDetail; onChange: (value: ReportDetail) => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const send = async (outcome: 'RESOLVED' | 'DISMISSED') => {
    if (note.trim().length < 3) return setError('Escribe una nota: quien denunció la recibirá.');
    const result = await post<ReportDetail>(`/api/admin/reports/${report.id}/resolve`, { outcome, note });
    if (result.ok) onChange(result.data);
    else setError(apiMessage(result));
  };
  return (
    <section aria-labelledby="resolve-title" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 sm:p-7">
      <h2 id="resolve-title" className="font-display text-2xl font-extrabold">
        Resolver
      </h2>
      <p>Primero actúa donde corresponda (archivar el producto, suspender la tienda, cancelar la reserva). Después cierra la denuncia.</p>
      <TextArea label="Nota para quien denunció" value={note} onChange={setNote} maxLength={1000} />
      {error && (
        <p role="alert" className="font-medium">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => send('RESOLVED')} className="min-h-12 cursor-pointer rounded-xl bg-accent px-5 font-bold text-ink">
          Tomamos medidas
        </button>
        <button type="button" onClick={() => send('DISMISSED')} className="min-h-12 cursor-pointer rounded-xl border-2 border-ink px-5 font-bold">
          Desestimar
        </button>
      </div>
    </section>
  );
}

export function ReportDetailPanel({ id, locale }: { id: string; locale: string }) {
  const { result, replace } = useResource<ReportDetail>(`/api/admin/reports/${id}`);
  return (
    <ResourceGate result={result}>
      {(report) => {
        const { target } = report;
        const links = [
          ...(target.slug ? [{ href: `/producto/${target.slug}`, label: 'Ver el producto' }] : []),
          ...(report.targetType === 'RESERVATION' ? [{ href: `/admin/reservas/${target.id}`, label: 'Ver la reserva' }] : []),
          { href: `/admin/tiendas/${target.storeId}`, label: `Ver la tienda (${target.storeName})` },
        ];
        return (
          <div className="flex flex-col gap-8">
            <div>
              <p className="text-xl font-bold">{report.title}</p>
              <p>
                {reportReasonLabel(report.reason)}. {reportStatusLabel(report.status)}, {new Date(report.createdAt).toLocaleString(locale)}
              </p>
            </div>
            {report.details && <p className="text-lg whitespace-pre-line">{report.details}</p>}
            <p>
              Denunció: <strong>{report.reporter.name}</strong> <span className="break-all">({report.reporter.email})</span>
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {links.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="font-bold underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            {report.status === 'OPEN' ? (
              <Resolve report={report} onChange={replace} />
            ) : (
              <p className="rounded-2xl bg-surface p-5 whitespace-pre-line">Nota: {report.resolution}</p>
            )}
          </div>
        );
      }}
    </ResourceGate>
  );
}
