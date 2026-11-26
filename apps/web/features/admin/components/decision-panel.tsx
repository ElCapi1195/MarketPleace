'use client';

import { useState } from 'react';
import { TextArea } from '@/features/shared/components/fields';

export interface Decision {
  action: string;
  label: string;
  needsReason: boolean;
}

interface DecisionPanelProps {
  decisions: readonly Decision[];
  /** Devuelve el error para la persona, o null si se aplicó. */
  onDecide: (action: string, reason: string) => Promise<string | null>;
}

/** Botones de decisión con un único motivo, obligatorio para las que detienen o devuelven. */
export function DecisionPanel({ decisions, onDecide }: DecisionPanelProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (decisions.length === 0) return null;

  const decide = async ({ action, needsReason }: Decision) => {
    if (busy) return;
    if (needsReason && reason.trim().length < 3) return setError('Explica el motivo: la tienda lo recibirá tal cual.');
    setBusy(true);
    const problem = await onDecide(action, reason);
    setError(problem);
    if (problem === null) setReason('');
    setBusy(false);
  };

  return (
    <section aria-labelledby="decision-title" className="flex flex-col gap-4 rounded-3xl bg-surface p-5 sm:p-7">
      <h2 id="decision-title" className="font-display text-2xl font-extrabold">
        Decisión
      </h2>
      {decisions.some(({ needsReason }) => needsReason) && (
        <TextArea label="Motivo" value={reason} onChange={setReason} maxLength={1000} hint="La tienda lo leerá. Obligatorio para todo lo que no sea aprobar." />
      )}
      {error && (
        <p role="alert" className="font-medium">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {decisions.map((decision) => (
          <button
            key={decision.action}
            type="button"
            disabled={busy}
            onClick={() => decide(decision)}
            className={`min-h-12 cursor-pointer rounded-xl px-5 font-bold disabled:cursor-wait disabled:opacity-60 ${decision.needsReason ? 'border-2 border-ink' : 'bg-accent text-ink'}`}
          >
            {decision.label}
          </button>
        ))}
      </div>
    </section>
  );
}
