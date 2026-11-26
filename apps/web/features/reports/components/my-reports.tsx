'use client';

import type { ReportView } from '@marketplace/contracts';
import { useEffect, useState } from 'react';
import { reportStatusLabel } from '@/features/admin/lib/reports';
import { get } from '@/lib/client-api';

/** Denuncias enviadas y su respuesta. No se muestra si no hay ninguna. */
export function MyReports() {
  const [reports, setReports] = useState<ReportView[]>([]);
  useEffect(() => {
    void get<ReportView[]>('/api/reports/mine').then((result) => {
      if (result.ok) setReports(result.data);
    });
  }, []);
  if (reports.length === 0) return null;
  return (
    <section aria-labelledby="reports-title" className="flex flex-col gap-3">
      <h2 id="reports-title" className="text-xl font-bold">
        Tus denuncias
      </h2>
      <ul>
        {reports.map((report) => (
          <li key={report.id} className="border-b-2 border-surface py-2">
            <p className="font-bold">{report.title}</p>
            <p>{reportStatusLabel(report.status)}</p>
            {report.resolution && <p className="whitespace-pre-line">{report.resolution}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
