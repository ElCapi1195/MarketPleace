'use client';

import type { PaymentView, StoreReservation } from '@marketplace/contracts';
import { useState, type FormEvent } from 'react';
import { formatMoney, parseMoney, writeMoney } from '@/features/catalog/lib/money';
import { SelectField, TextField } from '@/features/shared/components/fields';
import { apiMessage } from '@/features/shared/lib/messages';
import { post, type ApiResult } from '@/lib/client-api';
import { paymentOptions } from '../lib/forms';
import { paymentKindLabel, paymentMethods } from '../lib/status';
import { PaymentList } from './parts';

interface PaymentPanelProps {
  base: string;
  reservation: StoreReservation;
  locale: string;
  canWrite: boolean;
  onChange: (reservation: StoreReservation) => void;
}

function PaymentForm({ base, reservation, onChange }: PaymentPanelProps) {
  const { currency } = reservation;
  const options = paymentOptions(reservation);
  const first = options[0];
  const [kind, setKind] = useState<string>(first?.kind ?? '');
  const [amount, setAmount] = useState(first ? writeMoney(first.suggestedMinor, currency) : '');
  const [method, setMethod] = useState('TRANSFER');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!first) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const amountMinor = parseMoney(amount, currency);
    if (amountMinor === null || amountMinor === 0) return setError('Revisa el importe. Ejemplo: 100');
    const result = await post<StoreReservation>(`${base}/payments`, { kind, amountMinor, method, reference, note });
    if (result.ok) onChange(result.data);
    else setError(apiMessage(result));
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-3xl bg-surface p-5 sm:grid-cols-2 sm:p-7">
      <SelectField
        label="Movimiento"
        value={kind}
        onChange={(value) => {
          setKind(value);
          const option = options.find((item) => item.kind === value);
          if (option) setAmount(writeMoney(option.suggestedMinor, currency));
        }}
        options={options.map((option) => ({ value: option.kind, label: paymentKindLabel(option.kind) }))}
      />
      <TextField label={`Importe (${currency})`} value={amount} onChange={setAmount} inputMode="decimal" />
      <SelectField label="Cómo" value={method} onChange={setMethod} options={paymentMethods} />
      <TextField label="Folio (opcional)" value={reference} onChange={setReference} maxLength={80} hint="Nunca escribas números de tarjeta." />
      <TextField label="Nota (opcional)" wide value={note} onChange={setNote} maxLength={200} />
      {error && (
        <p role="alert" className="font-medium sm:col-span-2">
          {error}
        </p>
      )}
      <button type="submit" className="min-h-12 cursor-pointer rounded-xl bg-ink px-6 font-bold text-background sm:col-span-2 sm:justify-self-start">
        Anotar
      </button>
    </form>
  );
}

export function PaymentPanel(props: PaymentPanelProps) {
  const { base, reservation, locale, canWrite, onChange } = props;
  const { currency, paid, agreed, payments } = reservation;
  const [reversing, setReversing] = useState<PaymentView | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reverse = async () => {
    if (!reversing) return;
    if (reason.trim().length < 3) return setError('Explica por qué lo anulas.');
    const result: ApiResult<StoreReservation> = await post(`${base}/payments/${reversing.id}/reverse`, { reason });
    if (!result.ok) return setError(apiMessage(result));
    setReversing(null);
    setReason('');
    setError(null);
    onChange(result.data);
  };

  return (
    <section aria-labelledby="payments-title" className="flex flex-col gap-4">
      <h2 id="payments-title" className="font-display text-2xl font-extrabold">
        Dinero
      </h2>
      <p>Los cobros y devoluciones se hacen fuera de la web. Aquí solo se anotan: no se editan ni se borran, se anulan con otro movimiento.</p>
      <p className="text-lg">
        Recibido <strong>{formatMoney(paid.net, currency, locale)}</strong> de {formatMoney(agreed.priceMinor, currency, locale)}.
      </p>
      <PaymentList payments={payments} currency={currency} locale={locale} onReverse={canWrite ? setReversing : undefined} />
      {reversing && (
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
          <TextField label={`Por qué anulas ${formatMoney(reversing.amountMinor, currency, locale)}`} value={reason} onChange={setReason} maxLength={200} />
          {error && (
            <p role="alert" className="font-medium">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={reverse} className="min-h-12 cursor-pointer rounded-xl bg-ink px-5 font-bold text-background">
              Anular movimiento
            </button>
            <button type="button" onClick={() => setReversing(null)} className="min-h-12 cursor-pointer px-3 font-bold underline">
              Volver
            </button>
          </div>
        </div>
      )}
      {/* La clave reinicia el formulario con lo que falta tras cada movimiento. */}
      {canWrite && <PaymentForm key={`${reservation.status}-${payments.length}`} {...props} />}
    </section>
  );
}
