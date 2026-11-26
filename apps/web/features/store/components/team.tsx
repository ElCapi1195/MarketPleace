'use client';

import type { MemberView, StoreRole, TeamView } from '@marketplace/contracts';
import { useState, type FormEvent } from 'react';
import { SelectField, TextField } from '@/features/shared/components/fields';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { patch, post, remove, type ApiResult } from '@/lib/client-api';
import { roleLabel } from '../lib/status';
import { StoreShell } from './store-area';

const action = 'min-h-11 cursor-pointer rounded-lg border-2 border-ink px-4 font-bold';
const roles: StoreRole[] = ['OWNER', 'MANAGER', 'STAFF'];
const option = (role: StoreRole) => ({ value: role, label: roleLabel(role) });

function Invite({ base, onSent }: { base: string; onSent: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('STAFF');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const result = await post(`${base}/invitations`, { email, role });
    setError(result.ok ? null : result.code === 'VALIDATION_ERROR' ? 'Revisa el correo.' : apiMessage(result));
    setMessage(result.ok ? `Invitación enviada a ${email}.` : null);
    if (result.ok) {
      setEmail('');
      await onSent();
    }
  };

  return (
    <form onSubmit={send} noValidate className="grid items-end gap-4 rounded-3xl bg-surface p-5 sm:grid-cols-[1fr_12rem_auto] sm:p-7">
      <TextField label="Correo de la persona" type="email" value={email} onChange={setEmail} maxLength={254} />
      <SelectField label="Papel" value={role} onChange={setRole} options={[option('MANAGER'), option('STAFF')]} />
      <button type="submit" className="h-12 cursor-pointer rounded-xl bg-ink px-6 font-bold text-background">
        Invitar
      </button>
      <p className="sm:col-span-3">
        El encargado gestiona productos y aprueba reservas. El personal gestiona productos y consulta reservas.
      </p>
      {message && (
        <p role="status" className="font-medium sm:col-span-3">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="font-medium sm:col-span-3">
          {error}
        </p>
      )}
    </form>
  );
}

function Member({ member, base, run }: { member: MemberView; base: string; run: (task: Promise<ApiResult<unknown>>) => Promise<void> }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-surface py-3">
      <div className="min-w-48 flex-1">
        <p className="font-bold">{member.name}</p>
        <p className="text-sm break-all">{member.email}</p>
        {!member.twoFactorEnabled && <p className="text-sm font-medium">No puede entrar: le falta el segundo paso.</p>}
      </div>
      <select
        aria-label={`Papel de ${member.name}`}
        value={member.role}
        onChange={(event) => run(patch(`${base}/members/${member.userId}`, { role: event.target.value }))}
        className="h-11 rounded-lg border-2 border-ink/30 bg-background px-3 font-medium"
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {roleLabel(role)}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => run(remove(`${base}/members/${member.userId}`))} className={action}>
        Quitar
      </button>
    </li>
  );
}

function TeamPanel({ base, locale, approved }: { base: string; locale: string; approved: boolean }) {
  const { result, reload } = useResource<TeamView>(`${base}/members`);
  const [error, setError] = useState<string | null>(null);
  const run = async (task: Promise<ApiResult<unknown>>) => {
    const response = await task;
    setError(response.ok ? null : apiMessage(response));
    await reload();
  };
  return (
    <div className="flex flex-col gap-8">
      {approved ? <Invite base={base} onSent={reload} /> : <p className="text-lg">Podrás invitar a tu equipo cuando la tienda esté verificada.</p>}
      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink p-3 font-medium">
          {error}
        </p>
      )}
      <ResourceGate result={result}>
        {({ members, invitations }) => (
          <>
            <ul>
              {members.map((member) => (
                <Member key={`${member.userId}-${member.role}`} member={member} base={base} run={run} />
              ))}
            </ul>
            {invitations.length > 0 && (
              <section aria-labelledby="pending-title" className="flex flex-col gap-2">
                <h2 id="pending-title" className="font-display text-2xl font-extrabold">
                  Invitaciones pendientes
                </h2>
                <ul>
                  {invitations.map(({ id, email, role, expiresAt }) => (
                    <li key={id} className="flex flex-wrap items-center gap-4 border-b-2 border-surface py-3">
                      <p className="min-w-48 flex-1 break-all">
                        {email}. {roleLabel(role)}, vence el {new Date(expiresAt).toLocaleDateString(locale)}
                      </p>
                      <button type="button" onClick={() => run(remove(`${base}/invitations/${id}`))} className={action}>
                        Anular
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </ResourceGate>
    </div>
  );
}

export function Team({ id, locale }: { id: string; locale: string }) {
  return <StoreShell id={id}>{(store) => <TeamPanel base={`/api/stores/${id}`} locale={locale} approved={store.status === 'APPROVED'} />}</StoreShell>;
}
