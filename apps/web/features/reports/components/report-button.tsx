'use client';

import { useRef, useState } from 'react';
import { reasonsFor, reportReasonLabel } from '@/features/admin/lib/reports';
import { SelectField, TextArea } from '@/features/shared/components/fields';
import { apiMessage } from '@/features/shared/lib/messages';
import { withBasePath } from '@/lib/base-path';
import { post } from '@/lib/client-api';

type Target = { productSlug: string } | { reservationId: string };

/** Denunciar sin salir de la página. Sin sesión, lleva a entrar y vuelve. */
export function ReportButton({ target, label }: { target: Target; label: string }) {
  const kind = 'productSlug' in target ? 'PRODUCT' : 'RESERVATION';
  const reasons = reasonsFor(kind);
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<string>(reasons[0] ?? 'OTHER');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<{ kind: 'error' | 'done'; text: string } | null>(null);

  const send = async () => {
    const result = await post('/api/reports', { ...target, reason, details });
    if (!result.ok && result.status === 401) {
      window.location.assign(withBasePath(`/entrar?siguiente=${encodeURIComponent(window.location.pathname)}`));
      return;
    }
    setState(result.ok ? { kind: 'done', text: 'Gracias. Lo revisaremos y te avisaremos por correo.' } : { kind: 'error', text: apiMessage(result) });
  };

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="min-h-11 cursor-pointer self-start text-sm font-medium underline">
        {label}
      </button>
      <dialog ref={dialog} aria-labelledby="report-title" className="m-auto w-[min(32rem,92vw)] rounded-3xl bg-background p-6 backdrop:bg-ink/70">
        <div className="flex flex-col gap-4">
          <h2 id="report-title" className="font-display text-2xl font-extrabold">
            {label}
          </h2>
          {state?.kind === 'done' ? (
            <p role="status" className="text-lg">
              {state.text}
            </p>
          ) : (
            <>
              <SelectField label="Motivo" value={reason} onChange={setReason} options={reasons.map((value) => ({ value, label: reportReasonLabel(value) }))} />
              <TextArea label="Cuéntanos qué pasó (opcional)" value={details} onChange={setDetails} maxLength={2000} />
              {state?.kind === 'error' && (
                <p role="alert" className="font-medium">
                  {state.text}
                </p>
              )}
              <button type="button" onClick={send} className="min-h-12 cursor-pointer rounded-xl bg-ink px-5 font-bold text-background">
                Enviar denuncia
              </button>
            </>
          )}
          <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 cursor-pointer self-start font-bold underline">
            Cerrar
          </button>
        </div>
      </dialog>
    </>
  );
}
