'use client';

import type { StoreDetail } from '@marketplace/contracts';
import { documentTypes } from '@marketplace/contracts';
import { useState } from 'react';
import { apiMessage } from '@/features/shared/lib/messages';
import { withBasePath } from '@/lib/base-path';
import { remove, upload } from '@/lib/client-api';
import { checklist, documentProblem, type Requirement } from '../lib/documents';

interface DocumentListProps {
  store: StoreDetail;
  requirements: readonly Requirement[];
  editable: boolean;
  onChange: () => Promise<void>;
}

const action = 'inline-flex min-h-11 cursor-pointer items-center rounded-lg border-2 border-ink px-4 font-bold focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-ink';

export function DocumentList({ store, requirements, editable, onChange }: DocumentListProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const send = async (key: string, file: File) => {
    const problem = documentProblem(file);
    if (problem) return setError(problem);
    setPending(key);
    const result = await upload(`/api/stores/${store.id}/documents/${key}`, file, file.type);
    setError(result.ok ? null : apiMessage(result));
    await onChange();
    setPending(null);
  };

  const drop = async (id: string) => {
    const result = await remove(`/api/stores/${store.id}/documents/${id}`);
    setError(result.ok ? null : apiMessage(result));
    await onChange();
  };

  return (
    <section aria-labelledby="documents-title" className="flex flex-col gap-4">
      <h2 id="documents-title" className="font-display text-2xl font-extrabold">
        Documentos
      </h2>
      <p>PDF o imagen de hasta 10 MB. Solo los ve quien verifica tu tienda, y cada consulta queda registrada.</p>
      <ul className="flex flex-col">
        {checklist(requirements, store.documents).map(({ key, label, required, document }) => (
          <li key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-surface py-4">
            <div className="min-w-48 flex-1">
              <p className="font-bold">
                {label}
                {!required && ' (opcional)'}
              </p>
              <p role="status">{pending === key ? 'Subiendo…' : document ? 'Recibido' : 'Falta'}</p>
            </div>
            {document && (
              <a href={withBasePath(`/api/stores/${store.id}/documents/${document.id}`)} className="py-2 font-bold underline">
                Descargar
              </a>
            )}
            {editable && document && (
              <button type="button" onClick={() => drop(document.id)} className={action}>
                Eliminar
              </button>
            )}
            {editable && (
              <label className={action}>
                {document ? 'Sustituir' : 'Subir'}
                <span className="sr-only"> {label}</span>
                <input
                  type="file"
                  accept={documentTypes.join(',')}
                  disabled={pending !== null}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void send(key, file);
                  }}
                />
              </label>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink p-3 font-medium">
          {error}
        </p>
      )}
    </section>
  );
}
