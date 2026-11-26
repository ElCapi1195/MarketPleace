'use client';

import type { AdminUserDetail, AdminUserView } from '@marketplace/contracts';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { TextField } from '@/features/shared/components/fields';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { get, post } from '@/lib/client-api';

export function UserSearch() {
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<AdminUserView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = async (event: FormEvent) => {
    event.preventDefault();
    const result = await get<AdminUserView>(`/api/admin/users?email=${encodeURIComponent(email)}`);
    setFound(result.ok ? result.data : null);
    setError(result.ok ? null : result.status === 400 ? 'Escribe un correo completo.' : apiMessage(result));
  };
  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={search} noValidate className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
        <TextField label="Correo exacto de la cuenta" type="email" value={email} onChange={setEmail} maxLength={254} />
        <button type="submit" className="h-12 cursor-pointer rounded-xl bg-ink px-6 font-bold text-background">
          Buscar
        </button>
      </form>
      <p className="text-sm">Por privacidad no hay un listado de cuentas.</p>
      {error && <p role="alert">{error}</p>}
      {found && (
        <Link href={`/admin/usuarios/${found.id}`} className="rounded-2xl bg-surface p-5 hover:underline">
          <span className="block text-lg font-bold">{found.name}</span>
          <span className="block break-all">{found.email}</span>
          {found.suspendedAt && <span className="block font-bold">Suspendida</span>}
        </Link>
      )}
    </div>
  );
}

export function UserDetail({ id, locale }: { id: string; locale: string }) {
  const { result, reload } = useResource<AdminUserDetail>(`/api/admin/users/${id}`);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const act = async (user: AdminUserDetail) => {
    if (reason.trim().length < 3) return setError('Explica el motivo.');
    const result = await post(`/api/admin/users/${user.id}/${user.suspendedAt ? 'reinstate' : 'suspend'}`, { reason });
    setError(result.ok ? null : apiMessage(result));
    if (result.ok) {
      setReason('');
      await reload();
    }
  };

  return (
    <ResourceGate result={result}>
      {(user) => (
        <div className="flex flex-col gap-8">
          <p className="rounded-2xl border-2 border-ink p-4">Esta consulta queda registrada a tu nombre.</p>
          <div>
            <p className="text-2xl font-bold">{user.name}</p>
            <p className="break-all">{user.email}</p>
            <p>
              Rol {user.platformRole}. {user.twoFactorEnabled ? 'Con segundo paso.' : 'Sin segundo paso.'} Desde el{' '}
              {new Date(user.createdAt).toLocaleDateString(locale)}.
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 border-t-2 border-surface">
            {[
              ['Reservas', String(user.reservations.total)],
              ['Entregadas', String(user.reservations.completed)],
              ['Sin presentarse', String(user.reservations.noShow)],
              ['Canceladas', String(user.reservations.cancelled)],
              ['Denuncias enviadas', String(user.reports)],
            ].map(([label, value]) => (
              <div key={label} className="col-span-2 grid grid-cols-subgrid border-b-2 border-surface py-2.5">
                <dt>{label}</dt>
                <dd className="text-right font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          {user.stores.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-display text-2xl font-extrabold">Tiendas</h2>
              <ul>
                {user.stores.map((store) => (
                  <li key={store.id} className="border-b-2 border-surface py-2">
                    <Link href={`/admin/tiendas/${store.id}`} className="font-bold underline">
                      {store.name}
                    </Link>{' '}
                    ({store.role})
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="suspend-title" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 sm:p-7">
            <h2 id="suspend-title" className="font-display text-2xl font-extrabold">
              {user.suspendedAt ? 'Cuenta suspendida' : 'Suspender la cuenta'}
            </h2>
            {user.suspendedAt ? (
              <p>
                Desde el {new Date(user.suspendedAt).toLocaleString(locale)}. Motivo: {user.suspensionReason}
              </p>
            ) : (
              <p>Cierra todas sus sesiones y no podrá volver a entrar. Sus tiendas siguen activas: suspéndelas aparte si hace falta.</p>
            )}
            <TextField label="Motivo" value={reason} onChange={setReason} maxLength={500} />
            {error && (
              <p role="alert" className="font-medium">
                {error}
              </p>
            )}
            <button type="button" onClick={() => act(user)} className="min-h-12 cursor-pointer self-start rounded-xl bg-ink px-5 font-bold text-background">
              {user.suspendedAt ? 'Restituir' : 'Suspender'}
            </button>
          </section>
        </div>
      )}
    </ResourceGate>
  );
}
