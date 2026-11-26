'use client';

import type { ReservationOffer, StoreReservation } from '@marketplace/contracts';
import { useState } from 'react';
import { TextField } from '@/features/shared/components/fields';
import { writeMoney } from '@/features/catalog/lib/money';
import { offerFrom } from '../lib/forms';

interface ApprovalPanelProps {
  reservation: StoreReservation;
  onApprove: (offer: ReservationOffer | null) => Promise<void>;
}

/** Aprobar tal cual o proponer otro precio, depósito o fecha. */
export function ApprovalPanel({ reservation, onApprove }: ApprovalPanelProps) {
  const { agreed, currency, kind } = reservation;
  const [changing, setChanging] = useState(false);
  const [price, setPrice] = useState(writeMoney(agreed.priceMinor, currency));
  const [deposit, setDeposit] = useState(agreed.depositMinor > 0 ? writeMoney(agreed.depositMinor, currency) : '');
  const [availableOn, setAvailableOn] = useState(agreed.availableOn ?? '');
  const [error, setError] = useState<string | null>(null);

  const propose = async () => {
    const result = offerFrom({ price, deposit, availableOn }, kind, currency);
    if (!result.ok) return setError(result.error);
    setError(null);
    await onApprove(result.offer);
  };

  if (!changing) {
    return (
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => onApprove(null)} className="min-h-13 cursor-pointer rounded-xl bg-accent px-6 font-bold text-ink">
          Aprobar
        </button>
        <button type="button" onClick={() => setChanging(true)} className="min-h-13 cursor-pointer rounded-xl border-2 border-ink px-6 font-bold">
          Aprobar con cambios
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p>El cliente verá la propuesta y decidirá si la acepta.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label={`Precio (${currency})`} value={price} onChange={setPrice} inputMode="decimal" />
        <TextField label={`Depósito (${currency})`} value={deposit} onChange={setDeposit} inputMode="decimal" />
        {kind === 'PREORDER' && <TextField label="Llegada estimada" type="date" value={availableOn} onChange={setAvailableOn} />}
      </div>
      {error && (
        <p role="alert" className="font-medium">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={propose} className="min-h-13 cursor-pointer rounded-xl bg-accent px-6 font-bold text-ink">
          Enviar propuesta
        </button>
        <button type="button" onClick={() => setChanging(false)} className="min-h-13 cursor-pointer px-3 font-bold underline">
          Volver
        </button>
      </div>
    </div>
  );
}
