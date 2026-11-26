'use client';

import type { StoreDetail } from '@marketplace/contracts';
import { useState, type FormEvent } from 'react';
import { TextArea } from '@/features/shared/components/fields';
import { apiMessage } from '@/features/shared/lib/messages';
import { patch } from '@/lib/client-api';

export function PickupForm({ store, onChange }: { store: StoreDetail; onChange: () => Promise<void> }) {
  const [text, setText] = useState(store.pickupInfo);
  const [message, setMessage] = useState<{ kind: 'alert' | 'status'; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (text.trim().length < 5) return setMessage({ kind: 'alert', text: 'Explica cómo contactarte y dónde se recoge.' });
    const result = await patch(`/api/stores/${store.id}/pickup`, { pickupInfo: text });
    setMessage(result.ok ? { kind: 'status', text: 'Guardado.' } : { kind: 'alert', text: apiMessage(result) });
    if (result.ok) await onChange();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-extrabold">Contacto y recogida</h2>
      <TextArea
        label="Cómo contactarte, cómo pagarte y dónde se recoge"
        value={text}
        onChange={setText}
        maxLength={500}
        hint="Solo lo ven los clientes con una reserva aprobada. Sin esto no puedes aprobar reservas."
      />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="min-h-12 cursor-pointer rounded-xl bg-ink px-6 font-bold text-background">
          Guardar
        </button>
        {message && <p role={message.kind}>{message.text}</p>}
      </div>
    </form>
  );
}
